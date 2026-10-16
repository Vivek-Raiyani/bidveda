"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navigation/navbar";
import { ProtectedRoute, RoleGuard } from "@/lib/auth/auth-guard";
import { useAuth } from "@/lib/auth";
import { usersApi, rfqApi } from "@/lib/api";
import { User, AdminUserCreateInput, AdminUserUpdateInput } from "@/types/auth";
import { RFQListItem, RFQStatus } from "@/types/rfq";
import { UserRole } from "@/types/permissions";
import { RFQStatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  ShieldAlert,
  Users,
  FileText,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Ban,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Lock,
  Layers,
  ArrowUpRight,
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute redirectTo="/login">
      <RoleGuard
        roles={[UserRole.ADMIN]}
        fallback={
          <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Access Restricted
            </h1>
            <p className="text-sm text-zinc-400 max-w-md mb-6">
              You must have the <strong>Admin</strong> role to access this portal.
              Please switch accounts or contact your platform administrator.
            </p>
            <Link
              href="/rfqs"
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Back to Marketplace
            </Link>
          </div>
        }
      >
        <AdminDashboardContent />
      </RoleGuard>
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { user: currentAdmin } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"users" | "rfqs" | "security">("users");

  // User list state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "deleted">("all");
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotalItems, setUserTotalItems] = useState(0);

  // Global RFQs state
  const [rfqs, setRfqs] = useState<RFQListItem[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(false);
  const [rfqSearch, setRfqSearch] = useState("");
  const [rfqStatusFilter, setRfqStatusFilter] = useState<RFQStatus | "">("");
  const [rfqTotalItems, setRfqTotalItems] = useState(0);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState<AdminUserCreateInput>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: UserRole.BUYER,
    email_verified: true,
  });
  const [editForm, setEditForm] = useState<AdminUserUpdateInput>({
    first_name: "",
    last_name: "",
    email: "",
    role: UserRole.BUYER,
    email_verified: true,
    is_deleted: false,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const isDeletedParam =
        statusFilter === "deleted" ? true : statusFilter === "active" ? false : undefined;

      const res = await usersApi.list({
        page: userPage,
        limit: 10,
        q: userSearch.trim() || undefined,
        role: roleFilter || undefined,
        is_deleted: isDeletedParam,
      });

      setUsers(res.data || []);
      if (res.pagination) {
        setUserTotalPages(res.pagination.total_pages || 1);
        setUserTotalItems(res.pagination.total_items || 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userSearch, roleFilter, statusFilter, toast]);

  // Fetch RFQs for oversight
  const loadRFQs = useCallback(async () => {
    setRfqsLoading(true);
    try {
      const res = await rfqApi.list({
        page: 1,
        limit: 20,
        q: rfqSearch.trim() || undefined,
        status: rfqStatusFilter || undefined,
      });
      setRfqs(res.data || []);
      if (res.pagination) {
        setRfqTotalItems(res.pagination.total_items || 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load RFQs";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setRfqsLoading(false);
    }
  }, [rfqSearch, rfqStatusFilter, toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeTab === "rfqs") {
      loadRFQs();
    }
  }, [activeTab, loadRFQs]);

  // Handle User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionLoading(true);
    try {
      await usersApi.create(createForm);
      toast({
        title: "User Created",
        description: `Successfully added ${createForm.email} (${createForm.role}).`,
        variant: "success",
      });
      setCreateModalOpen(false);
      setCreateForm({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        role: UserRole.BUYER,
        email_verified: true,
      });
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      setFormError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setEditForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email,
      role: u.role,
      email_verified: !!u.email_verified,
      is_deleted: !!u.is_deleted,
    });
    setFormError(null);
    setEditModalOpen(true);
  };

  // Handle User Edit Save
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);
    setActionLoading(true);
    try {
      await usersApi.update(selectedUser.id, editForm);
      toast({
        title: "User Updated",
        description: `User ${editForm.email} updated successfully.`,
        variant: "success",
      });
      setEditModalOpen(false);
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update user";
      setFormError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Ban / Unban Toggle
  const handleToggleBan = async (u: User) => {
    if (u.id === currentAdmin?.id) {
      toast({
        title: "Safeguard Protected",
        description: "You cannot ban your own active admin account.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (u.is_deleted) {
        await usersApi.unban(u.id);
        toast({
          title: "Account Unbanned",
          description: `${u.email} is now reactivated.`,
          variant: "success",
        });
      } else {
        await usersApi.ban(u.id);
        toast({
          title: "Account Banned",
          description: `${u.email} has been deactivated and blocked.`,
          variant: "destructive",
        });
      }
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  // Open Delete Modal
  const openDeleteModal = (u: User) => {
    if (u.id === currentAdmin?.id) {
      toast({
        title: "Safeguard Protected",
        description: "You cannot delete your own active admin account.",
        variant: "destructive",
      });
      return;
    }
    setSelectedUser(u);
    setDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await usersApi.delete(selectedUser.id);
      toast({
        title: "User Deleted",
        description: `Account ${selectedUser.email} was soft-deleted.`,
        variant: "success",
      });
      setDeleteModalOpen(false);
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-indigo-950/40 via-zinc-900/80 to-zinc-950 p-6 sm:p-8 backdrop-blur-xl shadow-2xl mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    Admin Command Center
                  </h1>
                  <span className="text-xs uppercase font-bold tracking-widest text-indigo-400">
                    Governance & User Operations
                  </span>
                </div>
              </div>
              <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
                Global administrative oversight for BidVeda. Manage platform users,
                audit RFQ lifecycles, and enforce secure Role-Based Access Control policies.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create User</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Total Registered Users
              </span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">
              {userTotalItems}
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">Active Portal</span>
              <span>•</span>
              <span>Buyers, Vendors & Admins</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Platform RFQs
              </span>
              <FileText className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">
              {rfqTotalItems || "—"}
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center gap-2">
              <span className="text-sky-400 font-semibold">Procurement Pipeline</span>
              <span>•</span>
              <span>All Statuses</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                RBAC Security Policy
              </span>
              <Lock className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
              <CheckCircle className="h-5 w-5" />
              <span>Fully Enforced</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Sealed Bidding • HttpOnly JWT • Zero Leaks
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-zinc-800 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "users"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>User Management ({userTotalItems})</span>
          </button>
          <button
            onClick={() => setActiveTab("rfqs")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "rfqs"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>RFQ Oversight</span>
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "security"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Lock className="h-4 w-4" />
            <span>RBAC Policy Matrix</span>
          </button>
        </div>

        {/* Tab 1: User Management */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as UserRole | "");
                    setUserPage(1);
                  }}
                  aria-label="Filter by user role"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">All Roles</option>
                  <option value={UserRole.BUYER}>Buyers</option>
                  <option value={UserRole.VENDOR}>Vendors</option>
                  <option value={UserRole.ADMIN}>Admins</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as "all" | "active" | "deleted");
                    setUserPage(1);
                  }}
                  aria-label="Filter by account status"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Accounts</option>
                  <option value="active">Active Only</option>
                  <option value="deleted">Banned / Deactivated</option>
                </select>

                <button
                  onClick={() => loadUsers()}
                  className="rounded-xl border border-zinc-800 p-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                  title="Refresh users"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${usersLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Verification</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Created</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                            <span>Loading users directory...</span>
                          </div>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500">
                          No users matched the criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isSelf = u.id === currentAdmin?.id;
                        const roleColor =
                          u.role === UserRole.ADMIN
                            ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                            : u.role === UserRole.BUYER
                            ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
                            : "bg-purple-500/10 text-purple-300 border-purple-500/20";

                        return (
                          <tr
                            key={u.id}
                            className="hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-xs font-bold text-indigo-300">
                                  {u.first_name?.[0]?.toUpperCase() ||
                                    u.email[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-white flex items-center gap-2">
                                    <span>
                                      {u.first_name || ""} {u.last_name || ""}
                                    </span>
                                    {isSelf && (
                                      <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-zinc-400">
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${roleColor}`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              {u.email_verified ? (
                                <Badge variant="success">Verified</Badge>
                              ) : (
                                <Badge variant="outline">Unverified</Badge>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              {u.is_deleted ? (
                                <Badge variant="danger">Banned</Badge>
                              ) : (
                                <Badge variant="success">Active</Badge>
                              )}
                            </td>
                            <td className="py-4 px-4 text-xs text-zinc-400">
                              {u.created_at
                                ? new Date(u.created_at).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="py-4 px-4 sm:px-6 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                                  title="Edit user details"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>

                                <button
                                  onClick={() => handleToggleBan(u)}
                                  disabled={isSelf}
                                  className={`rounded-lg p-1.5 transition-colors ${
                                    isSelf
                                      ? "opacity-30 cursor-not-allowed text-zinc-600"
                                      : u.is_deleted
                                      ? "text-emerald-400 hover:bg-emerald-500/10"
                                      : "text-amber-400 hover:bg-amber-500/10"
                                  }`}
                                  title={
                                    isSelf
                                      ? "Cannot ban yourself"
                                      : u.is_deleted
                                      ? "Unban user"
                                      : "Ban user"
                                  }
                                >
                                  {u.is_deleted ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : (
                                    <Ban className="h-4 w-4" />
                                  )}
                                </button>

                                <button
                                  onClick={() => openDeleteModal(u)}
                                  disabled={isSelf}
                                  className={`rounded-lg p-1.5 transition-colors ${
                                    isSelf
                                      ? "opacity-30 cursor-not-allowed text-zinc-600"
                                      : "text-rose-400 hover:bg-rose-500/10"
                                  }`}
                                  title={
                                    isSelf
                                      ? "Cannot delete yourself"
                                      : "Soft delete user"
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {userTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 bg-zinc-950/40 text-xs text-zinc-400">
                  <div>
                    Page <span className="font-semibold text-white">{userPage}</span> of{" "}
                    <span className="font-semibold text-white">{userTotalPages}</span> (
                    {userTotalItems} users)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={userPage <= 1}
                      className="rounded-lg border border-zinc-800 p-1.5 text-zinc-300 disabled:opacity-30 hover:bg-zinc-800"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                      disabled={userPage >= userTotalPages}
                      className="rounded-lg border border-zinc-800 p-1.5 text-zinc-300 disabled:opacity-30 hover:bg-zinc-800"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: RFQ Oversight */}
        {activeTab === "rfqs" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search RFQs across entire portal..."
                  value={rfqSearch}
                  onChange={(e) => setRfqSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={rfqStatusFilter}
                  onChange={(e) => setRfqStatusFilter(e.target.value as RFQStatus | "")}
                  aria-label="Filter by RFQ status"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-medium text-zinc-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value={RFQStatus.DRAFT}>Draft</option>
                  <option value={RFQStatus.PUBLISHED}>Published</option>
                  <option value={RFQStatus.CLOSED}>Closed</option>
                  <option value={RFQStatus.AWARDED}>Awarded</option>
                </select>

                <button
                  onClick={() => loadRFQs()}
                  className="rounded-xl border border-zinc-800 p-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  title="Refresh RFQs"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${rfqsLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Title & Category</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Quotes</th>
                      <th className="py-3.5 px-4">Deadline</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {rfqsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                            <span>Loading global RFQs...</span>
                          </div>
                        </td>
                      </tr>
                    ) : rfqs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-500">
                          No RFQs found.
                        </td>
                      </tr>
                    ) : (
                      rfqs.map((rfq) => (
                        <tr
                          key={rfq.id}
                          className="hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-4 px-4 sm:px-6">
                            <div className="font-semibold text-white">
                              {rfq.title}
                            </div>
                            <div className="text-xs text-indigo-400">
                              {rfq.category || "General"}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <RFQStatusBadge status={rfq.status} />
                          </td>
                          <td className="py-4 px-4 text-xs text-zinc-300">
                            {rfq.delivery_location || "—"}
                          </td>
                          <td className="py-4 px-4 text-xs text-zinc-300 font-medium">
                            {rfq.quotes_count ?? 0} quotes
                          </td>
                          <td className="py-4 px-4 text-xs text-zinc-400">
                            {new Date(rfq.deadline).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/rfqs/${rfq.id}`}
                                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                <span>View</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                              <Link
                                href={`/rfqs/${rfq.id}/compare`}
                                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors ml-2"
                              >
                                <span>Matrix</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Security & RBAC Policy Matrix */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Lock className="h-5 w-5 text-indigo-400" />
                <span>Role-Based Access Control (RBAC) Governance Matrix</span>
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                BidVeda enforces strict privilege isolation across buyer, vendor, and administrator roles.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
                  <div className="flex items-center gap-2 font-bold text-sky-400 text-sm mb-3">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    <span>Buyer Role</span>
                  </div>
                  <ul className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                    <li>• Create, edit, and publish draft RFQs</li>
                    <li>• Scope limited strictly to own created RFQs</li>
                    <li>• Compare competitive bids side-by-side</li>
                    <li>• Award contract to winning vendor</li>
                    <li>• <strong>Restricted:</strong> Cannot submit quotes</li>
                    <li>• <strong>Restricted:</strong> Cannot access user administration</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
                  <div className="flex items-center gap-2 font-bold text-purple-400 text-sm mb-3">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    <span>Vendor Role</span>
                  </div>
                  <ul className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                    <li>• Browse published marketplace RFQs</li>
                    <li>• Submit granular line-item quotes before deadline</li>
                    <li>• Revise quotes prior to deadline cutoff</li>
                    <li>• Isolated portfolio for own submitted quotes</li>
                    <li>• <strong>Sealed Bidding:</strong> Cannot view competitors bids</li>
                    <li>• <strong>Restricted:</strong> Cannot create or award RFQs</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 border-rose-500/20">
                  <div className="flex items-center gap-2 font-bold text-rose-400 text-sm mb-3">
                    <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                    <span>Admin Role (Unrestricted)</span>
                  </div>
                  <ul className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                    <li>• Full control over users: create, edit, ban, delete</li>
                    <li>• Global oversight across all RFQs and quotes</li>
                    <li>• Complete audit trail & status transition logs</li>
                    <li>• Security self-safeguards against accidental demotion</li>
                    <li>• Immutable token validation via HttpOnly cookies</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New User Account"
        description="Add a new user directly into the system with specified role and credentials."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={createForm.first_name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, first_name: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={createForm.last_name || ""}
                onChange={(e) =>
                  setCreateForm({ ...createForm, last_name: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Temporary Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={createForm.password}
              onChange={(e) =>
                setCreateForm({ ...createForm, password: e.target.value })
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Assign Role *
              </label>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    role: e.target.value as UserRole,
                  })
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value={UserRole.BUYER}>Buyer</option>
                <option value={UserRole.VENDOR}>Vendor</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="create_email_verified"
                checked={createForm.email_verified}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    email_verified: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="create_email_verified"
                className="text-xs font-medium text-zinc-300"
              >
                Pre-verify Email
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {actionLoading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User Account"
        description="Modify user profile, role, or verification status."
        maxWidth="md"
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={editForm.first_name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, first_name: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={editForm.last_name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, last_name: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={editForm.email || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Role
              </label>
              <select
                value={editForm.role}
                disabled={selectedUser?.id === currentAdmin?.id}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    role: e.target.value as UserRole,
                  })
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-40"
              >
                <option value={UserRole.BUYER}>Buyer</option>
                <option value={UserRole.VENDOR}>Vendor</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
              {selectedUser?.id === currentAdmin?.id && (
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Cannot demote your own account
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="edit_email_verified"
                checked={editForm.email_verified}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    email_verified: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="edit_email_verified"
                className="text-xs font-medium text-zinc-300"
              >
                Email Verified
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {actionLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Soft Delete"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            Are you sure you want to deactivate and soft-delete user{" "}
            <strong className="text-white">{selectedUser?.email}</strong>?
          </p>
          <p className="text-xs text-zinc-500">
            The account will be flagged as deleted and immediate access to the
            portal will be revoked. You can restore access at any time.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={actionLoading}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {actionLoading ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
