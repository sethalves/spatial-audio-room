const path = require('path');
const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = ({ buildEnv }) => {
    let config = {
        entry: {
            "Audio": './src/index.ts',
        },
        plugins: [
            new webpack.DefinePlugin({
                'HIFI_API_VERSION': JSON.stringify(`v${require('./package.json').version}`)
            }),
            new CleanWebpackPlugin(),
            new CopyPlugin({
                patterns: [
                    { from: "vendor/*", to: "" },
                    { from: "assets/WASMAudioBuffer.js", to: "" },
                    { from: "assets/hifi.wasm.js", to: "" },
                    { from: "assets/HifiProcessor.js", to: "" }
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
                // Works around the warning emitted when Webpack can't find \`perf_hooks\` during compilation of `HiFiUtilites.ts` (which is fine).
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
