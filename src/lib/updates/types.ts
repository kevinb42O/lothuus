export type UpdateTarget = 'items' | 'visitors' | 'hearts';
export type WorkspaceUpdate = {
  id: string;
  date: string;
  title: string;
  body: string[];
  action?: { label: string; target: UpdateTarget };
};
