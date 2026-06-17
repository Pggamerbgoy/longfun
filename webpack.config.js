const path = require('path');
const WebpackObfuscator = require('webpack-obfuscator');

module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs'
  },
  devtool: false, // Disable source maps in production
  externals: {
    vscode: 'commonjs vscode',
    '@lancedb/lancedb': 'commonjs @lancedb/lancedb',
    'apache-arrow': 'commonjs apache-arrow'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new WebpackObfuscator({
        rotateStringArray: true,
        stringArray: true,
        stringArrayThreshold: 1.0,
        renameGlobals: false, // Disabled here because of lancedb/wasm imports
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        splitStrings: true,
        splitStringsChunkLength: 10,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
    }, ['excluded_bundle_name.js'])
  ]
};
