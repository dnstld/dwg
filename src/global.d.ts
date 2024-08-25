// global.d.ts

declare module "forge-viewer" {
  export interface Autodesk {
    Viewing: {
      GuiViewer3D: any;
      Document: {
        load: (documentId: string, onLoad: Function, onError: Function) => void;
      };
    };
  }

  const Autodesk: Autodesk;
  export default Autodesk;
}
