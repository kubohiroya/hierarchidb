import { Project, SyntaxKind, Node, TypeReferenceNode, CallExpression } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const targetGlobs = [
  'packages/plugin-loader/**/src/**/*.ts',
  'packages/plugin-loader/**/src/**/*.tsx',
];

const shouldRewriteWorkingCopyDraft = (node: TypeReferenceNode) => {
  const typeName = node.getTypeName().getText();
  return typeName === 'WorkingCopyDraft' || typeName.endsWith('.WorkingCopyDraft');
};

const shouldRewriteCreateDraft = (callExpr: CallExpression) => {
  const expressionText = callExpr.getExpression().getText();
  return expressionText === 'createDraftWorkingCopyBase' || expressionText.endsWith('.createDraftWorkingCopyBase');
};

const files = project.getSourceFiles(targetGlobs);

for (const sourceFile of files) {
  let modified = false;

  sourceFile.forEachDescendant((node) => {
    if (Node.isTypeReferenceNode(node) && shouldRewriteWorkingCopyDraft(node)) {
      const typeArgs = node.getTypeArguments();
      if (typeArgs.length > 1) {
        const lastArgText = typeArgs[typeArgs.length - 1]!.getText();
        node.setTypeArguments([lastArgText]);
        modified = true;
      }
    }

    if (Node.isCallExpression(node) && shouldRewriteCreateDraft(node)) {
      const typeArgs = node.getTypeArguments();
      if (typeArgs.length > 1) {
        const lastArgText = typeArgs[typeArgs.length - 1]!.getText();
        node.setTypeArguments([lastArgText]);
        modified = true;
      }
    }
  });

  if (modified) {
    sourceFile.fixUnusedIdentifiers();
  }
}

project.save().then(() => {
  // eslint-disable-next-line no-console
  console.log('WorkingCopy generics normalization complete.');
});
