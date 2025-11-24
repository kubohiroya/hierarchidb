import { Project, Node, TypeReferenceNode, CallExpression } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const targetGlobs = [
  'packages/plugin-loader/**/src/**/*.ts',
  'packages/plugin-loader/**/src/**/*.tsx',
];

const shouldRewriteDraftBase = (node: TypeReferenceNode) => {
  const typeName = node.getTypeName().getText();
  return typeName === 'DraftBase' || typeName.endsWith('.DraftBase');
};

const shouldRewriteCreateDraft = (callExpr: CallExpression) => {
  const expressionText = callExpr.getExpression().getText();
  return expressionText === 'createDraftBase' || expressionText.endsWith('.createDraftBase');
};

const files = project.getSourceFiles(targetGlobs);

for (const sourceFile of files) {
  let modified = false;

  sourceFile.forEachDescendant((node) => {
    if (Node.isTypeReferenceNode(node) && shouldRewriteDraftBase(node)) {
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
  console.log('Draft generics normalization complete.');
});
