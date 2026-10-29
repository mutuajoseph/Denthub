import { useMutation } from "@tanstack/react-query";

import { deleteAccount, fetchAccountExport } from "../lib/accountApi";

/** The export is a one-off download, so it is a mutation rather than cached state. */
export function useExportAccountData() {
  return useMutation({ mutationFn: () => fetchAccountExport() });
}

/** Deletion invalidates the token, so the caller signs out after it settles. */
export function useDeleteAccount() {
  return useMutation({ mutationFn: () => deleteAccount() });
}
