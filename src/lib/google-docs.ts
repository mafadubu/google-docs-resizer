import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

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
}

export const getGoogleDocsClient = (accessToken: string) => {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    return google.docs({ version: "v1", auth });
};

const getParagraphText = (p: any): string => {
    return p.elements?.map((e: any) => e.textRun?.content || "").join("").trim() || "";
};

const getHeadingLevel = (style: string | null | undefined): number => {
    if (!style) return 0;
    const match = style.match(/HEADING_(\d)/);
    return match ? parseInt(match[1]) : 0;
};

export const fetchDocumentStructure = async (docId: string, accessToken: string): Promise<DocumentStructure> => {
    const docs = getGoogleDocsClient(accessToken);
    const res = await docs.documents.get({ documentId: docId });
    const doc = res.data;

    const outline: DocumentOutlineItem[] = [];
    const content = doc.body?.content || [];

    // 1. Headings Identification
    content.forEach((el) => {
        if (el.paragraph) {
            const level = getHeadingLevel(el.paragraph.paragraphStyle?.namedStyleType);
            if (level > 0) {
                const text = getParagraphText(el.paragraph);
                if (text) {
                    outline.push({
                        id: `h-${el.startIndex}`,
                        title: text,
                        level,
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

    // 2. Set Boundaries
    for (let i = 0; i < outline.length; i++) {
        const next = outline[i + 1];
        outline[i].scopeEndIndex = next ? next.startIndex : (content[content.length - 1]?.endIndex || 999999);
    }

    // 3. Image Collection (Flat & Nested)
    const allImages: any[] = [];
    const processContent = (elements: any[]) => {
        elements.forEach(el => {
            if (el.paragraph) {
                // Inline
                el.paragraph.elements?.forEach((element: any) => {
                    if (element.inlineObjectElement) {
                        const id = element.inlineObjectElement.inlineObjectId;
                        const uri = doc.inlineObjects?.[id]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                        if (uri) allImages.push({ id, uri, startIndex: element.startIndex, type: 'inline' });
                    }
                });
                // Positioned
                el.paragraph.positionedObjectIds?.forEach((id: string) => {
                    const uri = doc.positionedObjects?.[id]?.positionedObjectProperties?.embeddedObject?.imageProperties?.contentUri;
                    if (uri) allImages.push({ id, uri, startIndex: el.startIndex, type: 'positioned' });
                });
            }
            if (el.table) {
                el.table.tableRows?.forEach((row: any) => {
                    row.tableCells?.forEach((cell: any) => processContent(cell.content || []));
                });
            }
        });
    };

    processContent(content);

    // 4. Assign to Chapters
    outline.forEach(ch => {
        ch.images = allImages.filter(img => img.startIndex >= ch.startIndex && img.startIndex < ch.scopeEndIndex);
        ch.imageCount = ch.images.length;
    });

    return { title: doc.title || "Untitled", items: outline };
};
