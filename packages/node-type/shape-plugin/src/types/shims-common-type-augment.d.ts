// Local augmentation for @hierarchidb/common-type (leaf-only)
declare module '@hierarchidb/common-type' {
  export type TagId = string & { readonly __brand: 'TagId' };
  export type NodeType = string & { readonly __brand: 'NodeType' };
}

