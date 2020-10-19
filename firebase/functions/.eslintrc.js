module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    "standard-with-typescript"
  ],
  parserOptions: {
    project: "tsconfig.json",
    sourceType: "module",
  },
  settings: {
    jsdoc: {
      tagNamePreference: {
        returns: "return",
      },
    },
  },
};
