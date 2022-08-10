const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = ({ buildEnv }) => {
    let config = {
        entry: {
            "Audio": [
                './example/canvas-control.js',
                './example/audio-room.js',
                './src/check-supported.js',
                './src/patchRTCPeerConnection.js',
                './src/hifi-audio.ts'
            ],
        },
        plugins: [
            new webpack.LoaderOptionsPlugin({
                debug: true
            }),
            new CopyPlugin({
                patterns: [
                    { from: "assets/hifi.wasm.js", to: "" },
                    { from: "assets/hifi.wasm.simd.js", to: "" },
                    { from: "assets/Logo-HighFidelity-Line-PrimaryBlue.svg", to: "" },
                    { from: "assets/High-Fidelity_Imagery_Brand_Logo_Left-Lockup_Black_v01.svg", to: "" },
                    { from: "assets/High-Fidelity_Imagery_Brand_Logo_Top-Right-Lockup_Black_v01-01.svg", to: "" },
                    { from: "assets/favicon.ico", to: "" },
                    { from: "assets/safari-pinned-tab.svg", to: "" },
                    { from: "assets/table.svg", to: "" },
                    { from: "assets/worker.js", to: "" },
                    { from: "assets/logo-white.svg", to: "" },
                    { from: "assets/controls-bg.jpg", to: "" },
                    { from: "assets/controls-bg-m.jpg", to: "" },
                    { from: "example/index.css", to: "" },
                    { from: "example/index.html", to: "" },
                    { from: "example/index-mobile.css", to: "" },
                    { from: "example/index-mobile.html", to: "" },
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
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
            alias: {
                './hifi-audio.js$': path.resolve(__dirname, 'src/hifi-audio.ts'),
                './transform.js$': path.resolve(__dirname, 'src/transform.ts')
            },
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
