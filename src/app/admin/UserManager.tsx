"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

type Props = {
  users: UserRow[];
  currentUserId: string;
};

const emptyForm = {
  username: "",
  displayName: "",
  password: "demo12",
  role: "JUDGE",
};

export function UserManager({ users, currentUserId }: Props) {
  const router = useRouter();
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ username: "", displayName: "", password: "", role: "JUDGE" });
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function showResult(ok: boolean, text: string) {
    setMessage(ok ? text : "");
    setError(ok ? "" : text);
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    setBusy(false);
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      showResult(false, body?.error ?? "Could not create user.");
      return;
    }
    setCreateForm(emptyForm);
    showResult(true, "User created.");
    router.refresh();
  }

  async function saveEdit() {
    if (!editUser) return;
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: editForm.username,
        displayName: editForm.displayName,
        role: editForm.role,
        ...(editForm.password ? { password: editForm.password } : {}),
      }),
    });
    setBusy(false);
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      showResult(false, body?.error ?? "Could not update user.");
      return;
    }
    setEditUser(null);
    showResult(true, "User updated.");
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteUser) return;
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/users/${deleteUser.id}`, { method: "DELETE" });
    setBusy(false);
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      showResult(false, body?.error ?? "Could not delete user.");
      setDeleteUser(null);
      return;
    }
    setDeleteUser(null);
    showResult(true, "User removed.");
    router.refresh();
  }

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        Display name appears on score sheets.
      </Typography>

      <Stack
        component="form"
        onSubmit={createUser}
        spacing={2}
        direction={{ xs: "column", md: "row" }}
        alignItems="flex-start"
        useFlexGap
        flexWrap="wrap"
      >
        <TextField
          label="Username (login)"
          value={createForm.username}
          onChange={(event) => setCreateForm((form) => ({ ...form, username: event.target.value }))}
          required
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Display name"
          value={createForm.displayName}
          onChange={(event) => setCreateForm((form) => ({ ...form, displayName: event.target.value }))}
          required
          sx={{ minWidth: 200 }}
          helperText="Shown to judges / on sheets"
        />
        <TextField
          label="Password"
          value={createForm.password}
          onChange={(event) => setCreateForm((form) => ({ ...form, password: event.target.value }))}
          required
          sx={{ minWidth: 140 }}
        />
        <TextField
          select
          label="Role"
          value={createForm.role}
          onChange={(event) => setCreateForm((form) => ({ ...form, role: event.target.value }))}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="ADMIN">ADMIN</MenuItem>
          <MenuItem value="JUDGE">JUDGE</MenuItem>
          <MenuItem value="SCRUTINEER">SCRUTINEER</MenuItem>
        </TextField>
        <Button type="submit" variant="contained" disabled={busy}>
          Add user
        </Button>
      </Stack>

      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Username</TableCell>
            <TableCell>Display name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.username}</TableCell>
              <TableCell>{row.displayName}</TableCell>
              <TableCell>{row.role}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setEditUser(row);
                      setEditForm({
                        username: row.username,
                        displayName: row.displayName,
                        password: "",
                        role: row.role,
                      });
                      setMessage("");
                      setError("");
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    disabled={row.id === currentUserId}
                    onClick={() => {
                      setDeleteUser(row);
                      setMessage("");
                      setError("");
                    }}
                  >
                    Remove
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Username (login)"
              value={editForm.username}
              onChange={(event) => setEditForm((form) => ({ ...form, username: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Display name"
              value={editForm.displayName}
              onChange={(event) => setEditForm((form) => ({ ...form, displayName: event.target.value }))}
              fullWidth
              required
              helperText="Can be different from the username"
            />
            <TextField
              select
              label="Role"
              value={editForm.role}
              onChange={(event) => setEditForm((form) => ({ ...form, role: event.target.value }))}
              fullWidth
            >
              <MenuItem value="ADMIN">ADMIN</MenuItem>
              <MenuItem value="JUDGE">JUDGE</MenuItem>
              <MenuItem value="SCRUTINEER">SCRUTINEER</MenuItem>
            </TextField>
            <TextField
              label="New password"
              value={editForm.password}
              onChange={(event) => setEditForm((form) => ({ ...form, password: event.target.value }))}
              fullWidth
              helperText="Leave blank to keep the current password"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={saveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteUser)} onClose={() => setDeleteUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Remove user?</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{deleteUser?.displayName}</strong> ({deleteUser?.username})? Their scores and
            heat submissions will be deleted too.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteUser(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={busy} onClick={confirmDelete}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
