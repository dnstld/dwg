// pages/_document.tsx

import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta name="grammarly" content="false" />
        </Head>
        <body>
          <Main />
          <NextScript />
          <script
            async
            src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"
          ></script>
        </body>
      </Html>
    );
  }
}
