export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function duplicateOwnerEmailMessage(email: string): string {
  return `Each login needs its own email. ${email} is already on another owner. One email is one account, even when two names are on the house.`;
}
