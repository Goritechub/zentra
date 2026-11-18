module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'refactor',
        'docs',
        'test',
        'style',
        'perf',
        'build',
        'ci',
      ],
    ],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [2, 'always', 100],
    'max-lines': [2, 'always', 3],
  },
  plugins: [
    {
      rules: {
        'max-lines': (parsed, _when, max) => {
          if (!parsed.raw) return [true];
          const lines = parsed.raw.trim().split(/\r?\n/);
          return [
            lines.length <= max,
            `Commit message must not exceed ${max} lines (currently ${lines.length} lines)`,
          ];
        },
      },
    },
  ],
};

