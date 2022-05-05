import 'dotenv/config';
import webpack from 'webpack';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

// 👇️ "/home/john/Desktop/javascript"
const __dirname = path.dirname(__filename);

export default (env) => {
  const mode = env.NODE_ENV;
  const publicPath = process.env.HOST;
  console.log({ publicPath });
  return {
    entry: './src/wallet-connect-script.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'wallet-connect-script.min.js',
      publicPath,
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.HOST': JSON.stringify(publicPath),
      }),
    ],
    mode,
  };
};
