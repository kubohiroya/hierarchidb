declare module 'shpjs' {
  const shp: {
    parseZip: (data: ArrayBuffer) => Promise<unknown>;
  };
  export default shp;
}
