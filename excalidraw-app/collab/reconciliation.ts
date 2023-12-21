import { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  orderByFractionalIndex,
  restoreFractionalIndices,
  validateFractionalIndices,
} from "../../packages/excalidraw/fractionalIndex";
import { AppState } from "../../packages/excalidraw/types";
import { arrayToMap } from "../../packages/excalidraw/utils";

export type ReconciledElements = readonly ExcalidrawElement[] & {
  _brand: "reconciledElements";
};

export type BroadcastedExcalidrawElement = ExcalidrawElement;

const shouldDiscardRemoteElement = (
  localAppState: AppState,
  local: ExcalidrawElement | undefined,
  remote: BroadcastedExcalidrawElement,
): boolean => {
  if (
    local &&
    // local element is being edited
    (local.id === localAppState.editingElement?.id ||
      local.id === localAppState.resizingElement?.id ||
      local.id === localAppState.draggingElement?.id || // Is this still valid? As draggingElement is selection element, which is never part of the elements array
      // local element is newer
      local.version > remote.version ||
      // resolve conflicting edits deterministically by taking the one with
      // the lowest versionNonce
      (local.version === remote.version &&
        local.versionNonce < remote.versionNonce))
  ) {
    return true;
  }
  return false;
};

export const reconcileElements = (
  localElements: readonly ExcalidrawElement[],
  remoteElements: readonly BroadcastedExcalidrawElement[],
  localAppState: AppState,
): ReconciledElements => {
  const localElementsData = arrayToMap(localElements);

  const reconciledElements: ExcalidrawElement[] = [];
  const added = new Set<string>();

  // process remote elements
  for (const remoteElement of remoteElements) {
    if (!added.has(remoteElement.id)) {
      // 'same' element and remote has made some changes
      if (localElementsData.has(remoteElement.id)) {
        const localElement = localElementsData.get(remoteElement.id);

        if (localElement) {
          if (
            shouldDiscardRemoteElement(
              localAppState,
              localElement,
              remoteElement,
            )
          ) {
            reconciledElements.push(localElement);
            added.add(localElement.id);
          } else {
            reconciledElements.push(remoteElement);
            added.add(remoteElement.id);
          }

          continue;
        }
      }

      reconciledElements.push(remoteElement);
      added.add(remoteElement.id);
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      reconciledElements.push(localElement);
      added.add(localElement.id);
    }
  }

  const validIndices = validateFractionalIndices(reconciledElements);

  return (validIndices
    ? orderByFractionalIndex(reconciledElements)
    : restoreFractionalIndices(
        orderByFractionalIndex(reconciledElements),
      )) as readonly ExcalidrawElement[] as ReconciledElements;
};
