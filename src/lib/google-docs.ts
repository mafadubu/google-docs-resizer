import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// --- Types ---
export interface DocumentOutlineItem {
    id: string;
    title: string;
    level: number;
    startIndex: number;
    endIndex: number;
    scopeEndIndex: number;
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

// --- Atomic Actions ---

/**
 * Finds a specific image by its object ID and returns its current metadata and position.
 * This is the crucial part for the "Atomic Sync" strategy.
 */
export const findImageMetadata = (doc: any, objectId: string) => {
    const inlineObj = doc.inlineObjects?.[objectId];
    const positionedObj = doc.positionedObjects?.[objectId];

    if (inlineObj) {
        // Find position in body
        let foundIndex = -1;
        const traverse = (elements: any[]) => {
            for (const el of elements) {
                if (el.paragraph) {
                    for (const element of el.paragraph.elements || []) {
                        if (element.inlineObjectElement?.inlineObjectId === objectId) {
                            foundIndex = element.startIndex;
                            return true;
                        }
                    }
                }
                if (el.table) {
                    for (const row of el.table.tableRows || []) {
                        for (const cell of row.tableCells || []) {
                            if (traverse(cell.content || [])) return true;
                        }
                    }
                }
            }
            return false;
        };
        traverse(doc.body?.content || []);

        if (foundIndex !== -1) {
            const props = inlineObj.inlineObjectProperties?.embeddedObject;
            return {
                type: 'inline' as const,
                id: objectId,
                index: foundIndex,
                uri: props?.imageProperties?.contentUri,
                width: props?.size?.width?.magnitude,
                height: props?.size?.height?.magnitude,
            };
        }
    }

    if (positionedObj) {
        // Find anchor paragraph
        let anchorIndex = -1;
        const traverse = (elements: any[]) => {
            for (const el of elements) {
                if (el.paragraph?.positionedObjectIds?.includes(objectId)) {
                    anchorIndex = el.startIndex;
                    return true;
                }
                if (el.table) {
                    for (const row of el.table.tableRows || []) {
                        for (const cell of row.tableCells || []) {
                            if (traverse(cell.content || [])) return true;
                        }
                    }
                }
            }
            return false;
        };
        traverse(doc.body?.content || []);

        const props = positionedObj.positionedObjectProperties?.embeddedObject;
        return {
            type: 'positioned' as const,
            id: objectId,
            anchorIndex: anchorIndex,
            uri: props?.imageProperties?.contentUri,
            width: props?.size?.width?.magnitude,
            height: props?.size?.height?.magnitude,
        };
    }

    return null;
};

// --- Structure Logic ---

export const fetchDocumentStructure = async (docId: string, accessToken: string): Promise<DocumentStructure> => {
    const docs = getGoogleDocsClient(accessToken);
    const res = await docs.documents.get({ documentId: docId });
    const doc = res.data;

    const outline: DocumentOutlineItem[] = [];
    const content = doc.body?.content || [];

    // 1. Extract Headings
    content.forEach((el, index) => {
        if (el.paragraph) {
            const headingType = el.paragraph.paragraphStyle?.namedStyleType;
            const level = getHeadingLevel(headingType);

            if (level > 0) {
                const text = getParagraphText([el]);
                if (text) {
                    outline.push({
                        id: `heading-${el.startIndex}`,
                        title: text,
                        level: level,
                        startIndex: el.startIndex || 0,
                        endIndex: el.endIndex || 0,
                        scopeEndIndex: 0,
                        imageCount: 0,
                        images: []
                    });
                }
            }
        }
    });

    // 2. Map Image Scopes (Chapters)
    for (let i = 0; i < outline.length; i++) {
        const current = outline[i];
        let nextBoundary = doc.body?.content?.length
            ? (doc.body.content[doc.body.content.length - 1].endIndex || 0)
            : 0;

        for (let j = i + 1; j < outline.length; j++) {
            if (outline[j].level <= current.level) {
                nextBoundary = outline[j].startIndex;
                break;
            }
        }
        current.scopeEndIndex = nextBoundary;
    }

    // 3. Collect Images
    const allImages: any[] = [];
    const collectFromContent = (elements: any[]) => {
        elements.forEach(el => {
            if (el.paragraph) {
                const pStart = el.startIndex || 0;
                // Inline
                el.paragraph.elements?.forEach((element: any) => {
                    const objId = element.inlineObjectElement?.inlineObjectId;
                    if (objId) {
                        const obj = doc.inlineObjects?.[objId];
                        const uri = obj?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                        if (uri) {
                            allImages.push({ id: objId, uri, startIndex: element.startIndex, type: 'inline' });
                        }
                    }
                });
                // Positioned
                el.paragraph.positionedObjectIds?.forEach((id: string) => {
                    const obj = doc.positionedObjects?.[id];
                    const uri = obj?.positionedObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                    if (uri) {
                        allImages.push({ id, uri, startIndex: pStart, type: 'positioned' });
                    }
                });
            }
            if (el.table) {
                el.table.tableRows?.forEach((row: any) => {
                    row.tableCells?.forEach((cell: any) => collectFromContent(cell.content || []));
                });
            }
        });
    };

    collectFromContent(content);

    // 4. Assign Images to Chapters
    outline.forEach(chapter => {
        chapter.images = allImages.filter(img => img.startIndex >= chapter.startIndex && img.startIndex < chapter.scopeEndIndex);
        chapter.imageCount = chapter.images.length;
    });

    return {
        title: doc.title || "Untitled Document",
        items: outline,
        inlineObjects: doc.inlineObjects || {},
        positionedObjects: doc.positionedObjects || {},
    };
};
