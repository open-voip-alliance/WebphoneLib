import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import builtins from "rollup-plugin-node-builtins";
import json from "rollup-plugin-json";

function onwarn(warning) {
  console.log(warning.toString());
}

export default {
  onwarn,
  input: "index.mjs",
  output: {
    file: "dist/vialer-web-calling.prod.mjs",
    format: "esm"
  },
  plugins: [resolve(), commonjs(), builtins(), json()]
};
