import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// --- Types ---
export interface DocumentOutlineItem {
    id: string;
    title: string;
    level: number;
    startIndex: number;
    endIndex: number;
    scopeEndIndex: number; // The end index of the "chapter"
    imageCount: number;
    images: Array<{
        id: string;
        uri: string;
        startIndex: number;
        type: 'inline' | 'positioned';
    }>;
}

export interface DocumentStructure {
    title: string;
    items: DocumentOutlineItem[];
    inlineObjects: Record<string, any>;
    positionedObjects: Record<string, any>;
}

export interface ResizeRequest {
    targetWidthCm: number;
    scopes?: Array<{ start: number; end: number }>;
    selectedImageIds?: string[];
}

// --- Helpers ---

export const getGoogleDocsClient = (accessToken: string) => {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    return google.docs({ version: "v1", auth });
};

export const getHeadingLevel = (headingType: string | undefined | null): number => {
    if (!headingType) return 0;
    switch (headingType) {
        case "HEADING_1": return 1;
        case "HEADING_2": return 2;
        case "HEADING_3": return 3;
        case "HEADING_4": return 4;
        case "HEADING_5": return 5;
        case "HEADING_6": return 6;
        case "TITLE": return 0;
        case "SUBTITLE": return 0;
        default: return 0;
    }
};

export const getParagraphText = (content: any[] = []): string => {
    return content
        .map((el) => el.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || "")
        .join("")
        .trim();
};

// --- Core Logic ---

export const fetchDocumentStructure = async (docId: string, accessToken: string): Promise<DocumentStructure> => {
    const docs = getGoogleDocsClient(accessToken);
    const res = await docs.documents.get({ documentId: docId });
    const doc = res.data;

    const outline: DocumentOutlineItem[] = [];
    const content = doc.body?.content || [];

    content.forEach((el, index) => {
        if (el.paragraph) {
            const headingType = el.paragraph.paragraphStyle?.namedStyleType;
            const level = getHeadingLevel(headingType);

            if (level > 0) {
                const text = getParagraphText([el]);
                if (text) {
                    outline.push({
                        id: el.startIndex?.toString() || index.toString(),
                        title: text,
                        level: level,
                        startIndex: el.startIndex || 0,
                        endIndex: el.endIndex || 0,
                        scopeEndIndex: 0, // Placeholder, updated below
                        imageCount: 0,
                        images: []
                    });
                }
            }
        }
    });

    // Calculate scopeEndIndex (Chapter boundaries)
    for (let i = 0; i < outline.length; i++) {
        const current = outline[i];
        let nextSiblingOrParentIndex = doc.body?.content?.length
            ? (doc.body.content[doc.body.content.length - 1].endIndex || 0)
            : 0;

        for (let j = i + 1; j < outline.length; j++) {
            const next = outline[j];
            if (next.level <= current.level) {
                nextSiblingOrParentIndex = next.startIndex;
                break;
            }
        }
        current.scopeEndIndex = nextSiblingOrParentIndex;
    }

    // New: Collect images for each chapter
    outline.forEach(chapter => {
        const chapterImages: any[] = [];

        const collectFromElement = (el: any) => {
            if (el.paragraph) {
                const elStart = el.startIndex || 0;
                const isInScope = elStart >= chapter.startIndex && elStart < chapter.scopeEndIndex;

                if (isInScope) {
                    // Inline Images
                    el.paragraph.elements?.forEach((element: any) => {
                        if (element.inlineObjectElement) {
                            const objId = element.inlineObjectElement.inlineObjectId;
                            const obj = doc.inlineObjects?.[objId];
                            const uri = obj?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                            if (uri) {
                                chapterImages.push({
                                    id: objId,
                                    uri: uri,
                                    startIndex: element.startIndex,
                                    type: 'inline'
                                });
                            }
                        }
                    });

                    // Positioned Images
                    el.paragraph.positionedObjectIds?.forEach((id: string) => {
                        const obj = doc.positionedObjects?.[id];
                        const uri = obj?.positionedObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                        if (uri) {
                            chapterImages.push({
                                id: id,
                                uri: uri,
                                startIndex: elStart,
                                type: 'positioned'
                            });
                        }
                    });
                }
            }
            if (el.table) {
                el.table.tableRows?.forEach((row: any) => {
                    row.tableCells?.forEach((cell: any) => {
                        cell.content?.forEach((contentEl: any) => collectFromElement(contentEl));
                    });
                });
            }
        };

        doc.body?.content?.forEach((el: any) => collectFromElement(el));

        chapter.images = chapterImages;
        chapter.imageCount = chapterImages.length;
    });

    return {
        title: doc.title || "Untitled Document",
        items: outline,
        inlineObjects: doc.inlineObjects || {},
        positionedObjects: doc.positionedObjects || {},
    };
};

export const calculateImageResizeRequests = (
    doc: any, // Raw API response
    options: ResizeRequest
) => {
    const actions: any[] = [];
    const targetWidthPt = options.targetWidthCm * 28.3465;

    // Helper to check scope
    const isInScope = (startIndex: number) => {
        // If scopes is provided and not empty, check if index is in ANY range
        if (options.scopes && options.scopes.length > 0) {
            return options.scopes.some(scope => startIndex >= scope.start && startIndex < scope.end);
        }
        // If no scopes provided, default to ALL
        return true;
    };

    // We need to collect ALL actions first, then sort them by index DESCENDING.
    // This prevents index shifting from affecting subsequent operations.

    const collectActions = (element: any) => {
        // 1. Inline Images
        if (element.paragraph) {
            const pStart = element.startIndex || 0;

            // Process Inline Images inside the paragraph
            element.paragraph.elements?.forEach((el: any) => {
                if (el.inlineObjectElement) {
                    const elStart = el.startIndex;
                    const inlineObjId = el.inlineObjectElement.inlineObjectId;

                    // Filtration Logic:
                    // 1. If individual images are selected, check if this ID is in the list.
                    // 2. Otherwise, check if it's within the selected chapters (scopes).
                    if (options.selectedImageIds && options.selectedImageIds.length > 0) {
                        if (!options.selectedImageIds.includes(inlineObjId)) return;
                    } else if (!isInScope(elStart)) {
                        return;
                    }

                    const inlineObj = doc.inlineObjects?.[inlineObjId];
                    if (inlineObj) {
                        const props = inlineObj.inlineObjectProperties?.embeddedObject;
                        const width = props?.size?.width?.magnitude;
                        const height = props?.size?.height?.magnitude;
                        const contentUri = props?.imageProperties?.contentUri;

                        if (width && height && contentUri) {
                            const scale = targetWidthPt / width;
                            const newHeightPt = height * scale;

                            actions.push({
                                type: 'inline',
                                id: inlineObjId,
                                index: elStart,
                                uri: contentUri,
                                width: targetWidthPt,
                                height: newHeightPt
                            });
                        }
                    }
                }
            });

            // Process Positioned Objects (Floating) attached to this paragraph
            if (element.paragraph.positionedObjectIds) {
                element.paragraph.positionedObjectIds.forEach((id: string) => {
                    // Filtration Logic (same as inline)
                    if (options.selectedImageIds && options.selectedImageIds.length > 0) {
                        if (!options.selectedImageIds.includes(id)) return;
                    } else if (!isInScope(pStart)) {
                        return;
                    }

                    const obj = doc.positionedObjects?.[id];
                    if (obj) {
                        const props = obj.positionedObjectProperties?.embeddedObject;
                        const width = props?.size?.width?.magnitude;
                        const height = props?.size?.height?.magnitude;
                        const contentUri = props?.imageProperties?.contentUri;

                        if (width && height && contentUri) {
                            const scale = targetWidthPt / width;
                            const newHeightPt = height * scale;

                            actions.push({
                                type: 'positioned',
                                id: id,
                                anchorIndex: pStart,
                                uri: contentUri,
                                width: targetWidthPt,
                                height: newHeightPt
                            });
                        }
                    }
                });
            }
        }

        // 2. Tables (Recurse)
        if (element.table) {
            element.table.tableRows?.forEach((row: any) => {
                row.tableCells?.forEach((cell: any) => {
                    cell.content?.forEach((contentEl: any) => collectActions(contentEl));
                });
            });
        }
    };

    doc.body?.content?.forEach((el: any) => collectActions(el));

    // Sort actions by Index Descending to keep indices stable
    actions.sort((a, b) => {
        const valA = (a.type === 'inline' ? a.index : a.anchorIndex) || 0;
        const valB = (b.type === 'inline' ? b.index : b.anchorIndex) || 0;
        if (valB !== valA) return valB - valA;
        // If same index, process 'positioned' first to avoid text shift issues
        if (a.type !== b.type) return a.type === 'positioned' ? -1 : 1;
        return 0;
    });

    const requests: any[] = [];
    const originalIds: string[] = [];

    actions.forEach(action => {
        if (action.type === 'inline') {
            // BACK TO DELETE-INSERT STRATEGY
            // Since property update is NOT officially in Docs API v1 batchUpdate.
            requests.push({
                deleteContentRange: {
                    range: {
                        startIndex: action.index,
                        endIndex: action.index + 1
                    }
                }
            });
            requests.push({
                insertInlineImage: {
                    uri: action.uri,
                    location: { index: action.index },
                    objectSize: {
                        width: { magnitude: action.width, unit: 'PT' },
                        height: { magnitude: action.height, unit: 'PT' }
                    }
                }
            });
            originalIds.push(action.id);
        } else if (action.type === 'positioned') {
            requests.push({
                deletePositionedObject: {
                    objectId: action.id
                }
            });
            requests.push({
                insertInlineImage: {
                    uri: action.uri,
                    location: { index: action.anchorIndex },
                    objectSize: {
                        width: { magnitude: action.width, unit: 'PT' },
                        height: { magnitude: action.height, unit: 'PT' }
                    }
                }
            });
            originalIds.push(action.id);
        }
    });

    return { requests, originalIds };
};
