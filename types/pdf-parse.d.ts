// types/pdf-parse.d.ts
declare module "pdf-parse" {
  interface PDFInfo {
    numpages?: number;
    numrender?: number;
    info?: any;
    metadata?: any;
    version?: string;
  }

  interface PDFData {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: any;
    metadata?: any;
    version?: string;
  }

  type PDFParse = (dataBuffer: Buffer | Uint8Array) => Promise<PDFData>;

  const pdfParse: PDFParse;
  export default pdfParse;
}
