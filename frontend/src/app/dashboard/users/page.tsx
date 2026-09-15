'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Pagination } from '@/components/dashboard/Pagination';
import { Table, Th, Td, EmptyState } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { api, getList, ApiRequestError, type ApiErrorDetail } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import type { PageMeta, Role, User } from '@/lib/types';

const CREATABLE_ROLES: Role[] = ['SALES', 'SANCTION', 'DISBURSEMENT', 'COLLECTION', 'BORROWER'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'SALES' as Role });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const closeModal = useCallback(() => setCreating(false), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getList<User>(`/admin/users?page=${page}&limit=20`);
      setUsers(data.items);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser() {
    setFormError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      await api.post('/admin/users', form);
      setNotice(`${form.email} can now sign in as ${titleCase(form.role)}.`);
      setCreating(false);
      setForm({ fullName: '', email: '', password: '', role: 'SALES' });
      void load();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
        setFieldErrors(
          Object.fromEntries(
            err.details
              .filter((d: ApiErrorDetail) => d.field)
              .map((d: ApiErrorDetail) => [d.field as string, d.message]),
          ),
        );
      } else {
        setFormError('Could not create the account.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: User) {
    setError(null);
    try {
      await api.patch(`/admin/users/${user.id}/status`, { isActive: !user.isActive });
      void load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update the account.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Create the accounts your team signs in with. Deactivating one ends its sessions immediately."
        actions={<Button onClick={() => setCreating(true)}>Add user</Button>}
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <EmptyState title="No users yet." hint="Add your first team account." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Last signed in</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td>{user.fullName}</Td>
                  <Td>
                    <span className="text-xs">{user.email}</span>
                  </Td>
                  <Td>{titleCase(user.role)}</Td>
                  <Td>
                    <span className="text-xs text-muted">{formatDateTime(user.lastLoginAt)}</span>
                  </Td>
                  <Td>
                    <span className={user.isActive ? 'text-sm' : 'text-sm text-muted'}>
                      {user.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </Td>
                  <Td align="right">
                    {user.role === 'ADMIN' ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      <Button variant="secondary" onClick={() => void toggleActive(user)}>
                        {user.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}

      <Modal open={creating} title="Add a user" onClose={closeModal}>
        <div className="space-y-5">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
            <TextInput
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <TextInput
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </Field>

          <Field
            label="Temporary password"
            htmlFor="password"
            hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number. Share it securely and ask them to change it."
            error={fieldErrors.password}
          >
            <TextInput
              id="password"
              type="text"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </Field>

          <Field label="Role" htmlFor="role" hint="The system supports exactly one admin, so admin is not offered here.">
            <Select
              id="role"
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Role }))}
            >
              {CREATABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {titleCase(role)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-2">
            <Button loading={busy} onClick={() => void createUser()}>
              Create user
            </Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
