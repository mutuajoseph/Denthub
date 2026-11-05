import { useMutation } from "@tanstack/react-query";

import { deleteAccount, fetchAccountExport } from "../lib/accountApi";
import { requestPasswordReset, resetPassword, verifyEmail } from "../lib/auth";

/** The export is a one-off download, so it is a mutation rather than cached state. */
export function useExportAccountData() {
  return useMutation({ mutationFn: () => fetchAccountExport() });
}

/** Deletion invalidates the token, so the caller signs out after it settles. */
export function useDeleteAccount() {
  return useMutation({ mutationFn: () => deleteAccount() });
}

/** Spend an emailed verification token. */
export function useVerifyEmail() {
  return useMutation({ mutationFn: (token: string) => verifyEmail(token) });
}

/** Ask for a reset link; the answer is the same whether or not the email has an account. */
export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (email: string) => requestPasswordReset(email) });
}

/** Set a new password with an emailed reset token. */
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      resetPassword(token, newPassword),
  });
}
