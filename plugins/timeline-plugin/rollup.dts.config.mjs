import dts from 'rollup-plugin-dts';

const external = [/^@hierarchidb\//];

export default [
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.d.ts', format: 'es' },
    plugins: [dts()],
    external,
  },
  {
    input: 'src/services/index.ts',
    output: { file: 'dist/services/index.d.ts', format: 'es' },
    plugins: [dts()],
    external,
  },
  {
    input: 'src/ui/index.ts',
    output: { file: 'dist/ui/index.d.ts', format: 'es' },
    plugins: [dts()],
    external,
  },
  {
    input: 'src/icon/index.ts',
    output: { file: 'dist/icon/index.d.ts', format: 'es' },
    plugins: [dts()],
    external,
  },
];
