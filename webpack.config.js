const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = ({ buildEnv }) => {
    let config = {
        entry: {
            "Audio": './src/index.ts',
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
                    { from: "vendor/*", to: "" }
                ],
            }),
        ],
        output: {
            filename: `HighFidelity[name]-latest.js`,
            path: path.resolve(__dirname, 'dist'),
            // The two options below are the keys to allowing other developers
            // to use the libarary without making use of any loaders.
            library: 'HighFidelity[name]',
            libraryTarget: 'var'
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
