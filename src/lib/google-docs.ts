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
}

export interface DocumentStructure {
    title: string;
    items: DocumentOutlineItem[];
    inlineObjects: Record<string, any>;
    positionedObjects: Record<string, any>;
}

export interface ResizeRequest {
    targetWidthCm: number;
    scopeStartIndex?: number;
    scopeEndIndex?: number;
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
                    });
                }
            }
        }
    });

    // Calculate scopeEndIndex (Chapter boundaries)
    for (let i = 0; i < outline.length; i++) {
        const current = outline[i];
        // Default to end of document
        let nextSiblingOrParentIndex = doc.body?.content?.length
            ? (doc.body.content[doc.body.content.length - 1].endIndex || 0)
            : 0;

        for (let j = i + 1; j < outline.length; j++) {
            const next = outline[j];
            // If we find a heading that is same level or higher (smaller number), that ends this section
            if (next.level <= current.level) {
                nextSiblingOrParentIndex = next.startIndex;
                break;
            }
        }
        current.scopeEndIndex = nextSiblingOrParentIndex;
    }

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
        if (typeof options.scopeStartIndex === 'number' && typeof options.scopeEndIndex === 'number') {
            return startIndex >= options.scopeStartIndex && startIndex < options.scopeEndIndex;
        }
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
                    if (!isInScope(elStart)) return;

                    const inlineObjId = el.inlineObjectElement.inlineObjectId;
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
                if (isInScope(pStart)) {
                    element.paragraph.positionedObjectIds.forEach((id: string) => {
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
                                    anchorIndex: pStart, // Insert at start of paragraph
                                    uri: contentUri,
                                    width: targetWidthPt,
                                    height: newHeightPt
                                });
                            }
                        }
                    });
                }
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

    // Sort actions by Index Descending
    // For Positioned objects, we use anchorIndex.
    // We should process actions completely from end to start.
    actions.sort((a, b) => {
        const idxA = a.type === 'inline' ? a.index : a.anchorIndex;
        const idxB = b.type === 'inline' ? b.index : b.anchorIndex;
        return idxB - idxA;
    });

    const requests: any[] = [];

    actions.forEach(action => {
        if (action.type === 'inline') {
            // 1. Insert New Image at current index
            requests.push({
                insertInlineImage: {
                    uri: action.uri,
                    location: { index: action.index },
                    objectSize: {
                        width: { magnitude: targetWidthPt, unit: 'PT' },
                        height: { magnitude: action.height, unit: 'PT' }
                    }
                }
            });
            // 2. Delete Old Image. 
            // After insertion, the old image (1 char) is pushed to index + 1.
            // So we delete range [index + 1, index + 2).
            requests.push({
                deleteContentRange: {
                    range: {
                        startIndex: action.index + 1,
                        endIndex: action.index + 2
                    }
                }
            });
        } else if (action.type === 'positioned') {
            // 1. Delete Positioned Object (ID based, no index shift for text)
            requests.push({
                deletePositionedObject: {
                    objectId: action.id
                }
            });
            // 2. Insert New Inline Image at Anchor Paragraph Start
            requests.push({
                insertInlineImage: {
                    uri: action.uri,
                    location: { index: action.anchorIndex },
                    objectSize: {
                        width: { magnitude: targetWidthPt, unit: 'PT' },
                        height: { magnitude: action.height, unit: 'PT' }
                    }
                }
            });
        }
    });

    return requests;
};
