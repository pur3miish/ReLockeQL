import {
  getDirectiveValues,
  GraphQLIncludeDirective,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  Kind,
  type SelectionSetNode
} from "graphql";

function selectionIsIncluded(
  node: Parameters<typeof getDirectiveValues>[1],
  variableValues: GraphQLResolveInfo["variableValues"]
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if (skip?.if === true) return false;

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues
  );
  return include?.if !== false;
}

function collectSelectedFields(
  selectionSet: SelectionSetNode,
  info: GraphQLResolveInfo,
  selectedFields: Set<string>,
  visitedFragments: Set<string>
): void {
  for (const selection of selectionSet.selections) {
    if (!selectionIsIncluded(selection, info.variableValues)) continue;

    if (selection.kind === Kind.FIELD) {
      selectedFields.add(selection.name.value);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      collectSelectedFields(
        selection.selectionSet,
        info,
        selectedFields,
        visitedFragments
      );
      continue;
    }

    const fragmentName = selection.name.value;
    if (visitedFragments.has(fragmentName)) continue;

    const fragment = info.fragments[fragmentName];
    if (!fragment) continue;

    visitedFragments.add(fragmentName);
    collectSelectedFields(
      fragment.selectionSet,
      info,
      selectedFields,
      visitedFragments
    );
  }
}

/**
 * Return the schema field names selected immediately below the current field.
 * Aliases, fragments, and GraphQL inclusion directives are resolved.
 */
export function getSelectedFields(info: GraphQLResolveInfo): Set<string> {
  const selectedFields = new Set<string>();
  const visitedFragments = new Set<string>();

  for (const fieldNode of info.fieldNodes) {
    if (fieldNode.selectionSet) {
      collectSelectedFields(
        fieldNode.selectionSet,
        info,
        selectedFields,
        visitedFragments
      );
    }
  }

  return selectedFields;
}
