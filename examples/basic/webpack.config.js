
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: './src/index.js',
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "src/canvas-control.js", to: "" },
                { from: "*.html", to: "" },
                { from: "*.css", to: "" },
                { from: "*.svg", to: "" },
                { from: "*.wav", to: "" },
            ],
        }),
    ],
    // mode: 'production'
    mode: 'development'
};
