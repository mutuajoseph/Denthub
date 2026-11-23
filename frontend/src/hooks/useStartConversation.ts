import { useMutation, useQueryClient } from "@tanstack/react-query";

import { startConversation } from "../lib/messagesApi";

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recipientId, body }: { recipientId: string; body: string }) =>
      startConversation(recipientId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
