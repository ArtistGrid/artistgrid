// types/index.d.ts

// This tells TypeScript that whenever we import a file ending in .csv,
// its default export will be a string.
declare module '*.csv' {
  const content: string;
  export default content;
}