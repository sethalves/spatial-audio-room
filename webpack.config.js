const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = ({ buildEnv }) => {
    let config = {
        entry: {
            "Audio": [
                './example/canvas-control.js',
                './example/index.js',
                './src/check-supported.js',
                './src/patchRTCPeerConnection.js',
                './src/index.ts'
            ],
        },
        plugins: [
            new webpack.LoaderOptionsPlugin({
                debug: true
            }),
            new CopyPlugin({
                patterns: [
                    { from: "assets/HifiProcessor.js", to: "" },
                    { from: "assets/HifiProcessorSIMD.js", to: "" },
                    { from: "assets/hifi.wasm.js", to: "" },
                    { from: "assets/hifi.wasm.simd.js", to: "" },
                    { from: "assets/WASMAudioBuffer.js", to: "" },
                    { from: "assets/worker.js", to: "" },
                    { from: "example/index.css", to: "" },
                    { from: "example/index.html", to: "" },
                    { from: "example/listener.svg", to: "" },
                    { from: "example/sound.wav", to: "" },
                    { from: "example/source.svg", to: "" },
                    { from: "vendor/*", to: "" }
                ],
            }),
        ],
        output: {
            filename: `audio-room.js`,
            path: path.resolve(__dirname, 'dist')
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                'perf_hooks': false
            }
        },
    };

    if (buildEnv !== "prod") {
        config["mode"] = "development";
        config["devtool"] = 'inline-source-map';
    } else {
        config["mode"] = "production";
        config["optimization"] = {
            "minimize": true,
        };
    }
    return config;
}
