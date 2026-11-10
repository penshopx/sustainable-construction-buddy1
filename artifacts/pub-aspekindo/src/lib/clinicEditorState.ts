/** A draft's revision is pinned until saved or explicitly rebased by its operator. */
export type ClinicVersion = {
  revision: number;
  status: "open" | "in_review" | "answered" | "closed";
  operatorReply: string;
};
export type ClinicEditorState = {
  base: ClinicVersion;
  status: ClinicVersion["status"];
  reply: string;
};
export function clinicEditorInitial(base: ClinicVersion): ClinicEditorState {
  return { base, status: base.status, reply: base.operatorReply };
}
export function receiveClinicVersion(draft: ClinicEditorState, latest: ClinicVersion): ClinicEditorState {
  if (latest.revision <= draft.base.revision) return draft;
  const dirty = draft.status !== draft.base.status || draft.reply !== draft.base.operatorReply;
  return dirty ? draft : clinicEditorInitial(latest);
}
export function rebaseClinicDraft(draft: ClinicEditorState, latest: ClinicVersion): ClinicEditorState {
  // Never replace a locally typed reply or status, even after a conflict.
  return latest.revision < draft.base.revision ? draft : { ...draft, base: latest };
}
