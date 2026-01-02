import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { formatRoleLabel } from "@/lib/roles";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
export function UsersList() {
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();
  const {
    isAdmin,
    isGestorMaster
  } = useUserRole();
  const {
    data: users = [],
    isLoading
  } = useQuery({
    queryKey: ["all-users-combined"],
    queryFn: async () => {
      // Get all authenticated users with roles via edge function
      const {
        data: authData,
        error: authError
      } = await supabase.functions.invoke('list-users');
      if (authError) {
        console.error('Error fetching auth users:', authError);
      }
      const authUsers = authData?.users || [];

      // Get all profiles
      const {
        data: profiles,
        error: profilesError
      } = await supabase.from('user_profiles').select('*').order('created_at', {
        ascending: false
      });
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Merge: authenticated users with their profiles + roles
      const mergedUsers = authUsers.map((authUser: any) => {
        const profile = profiles?.find(p => p.id === authUser.id);
        return {
          id: authUser.id,
          email: authUser.email,
          full_name: profile?.full_name || authUser.email,
          employment_status: profile?.employment_status || 'ativo',
          is_authenticated_user: true,
          created_at: authUser.created_at,
          roles: authUser.roles || [],
          ...profile
        };
      });

      // Add profiles without auth (clients)
      const profilesWithoutAuth = profiles?.filter(p => !authUsers.find((u: any) => u.id === p.id)) || [];

      // Filter out users with admin role
      const filteredUsers = mergedUsers.filter(user => {
        const hasAdminRole = user.roles?.includes('admin');
        return !hasAdminRole;
      });
      return [...filteredUsers, ...profilesWithoutAuth];
    }
  });
  const statusMutation = useMutation({
    mutationFn: async ({
      userId,
      newStatus
    }: {
      userId: string;
      newStatus: string;
    }) => {
      const user = users.find(u => u.id === userId);

      // Check if profile exists
      const {
        data: existingProfile
      } = await supabase.from('user_profiles').select('id').eq('id', userId).single();
      if (existingProfile) {
        // Update existing
        const {
          error
        } = await supabase.from('user_profiles').update({
          employment_status: newStatus
        }).eq('id', userId);
        if (error) throw error;
      } else {
        // Create profile for authenticated user
        const {
          error
        } = await supabase.from('user_profiles').insert({
          id: userId,
          email: user?.email || '',
          full_name: user?.full_name || user?.email || '',
          employment_status: newStatus,
          is_authenticated_user: true
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Status atualizado",
        description: "Status do usuário alterado com sucesso."
      });
      queryClient.invalidateQueries({
        queryKey: ["all-users-combined"]
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err.message || "Não foi possível atualizar o status.",
        variant: "destructive"
      });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Call the delete-user edge function to delete from auth
      const {
        data,
        error
      } = await supabase.functions.invoke('delete-user', {
        body: {
          userId
        }
      });
      if (error) {
        throw new Error(error.message || 'Erro ao excluir usuário');
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Usuário excluído',
        description: 'Usuário removido com sucesso do sistema.'
      });
      queryClient.invalidateQueries({
        queryKey: ['all-users-combined']
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível excluir o usuário.',
        variant: 'destructive'
      });
    }
  });
  if (isLoading) {
    return <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>;
  }
  const handleStatusToggle = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    const action = newStatus === 'inativo' ? 'inativar' : 'reativar';
    if (!window.confirm(`Tem certeza que deseja ${action} este usuário?`)) return;
    statusMutation.mutate({
      userId,
      newStatus
    });
  };
  const handleDelete = (userId: string) => {
    if (!window.confirm('ATENÇÃO: Esta ação removerá o perfil permanentemente. Continuar?')) return;
    deleteMutation.mutate(userId);
  };
  return <Card>
      <CardHeader>
        <CardTitle>Todos os Usuários</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="border border-inherit">Email</TableHead>
              <TableHead className="border border-inherit">Nome Completo</TableHead>
              <TableHead className="border border-inherit">ID</TableHead>
              <TableHead className="border border-inherit">Status</TableHead>
              <TableHead className="border border-inherit">Roles</TableHead>
              <TableHead className="border">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: any) => {
            const isActive = user.employment_status !== 'inativo';
            return <TableRow key={user.id}>
                  <TableCell className="border">{user.email}</TableCell>
                  <TableCell className="border">{user.full_name || '-'}</TableCell>
                  <TableCell className="border">
                    <Badge className={`${getIdBadgeColor(getShortUserId(user.id))} font-semibold`}>
                      {getShortUserId(user.id)}
                    </Badge>
                  </TableCell>
                  <TableCell className="border">
                    <Badge variant={isActive ? "default" : "secondary"} className="rounded-lg bg-teal-600 shadow-md border-slate-500">
                      {isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="border">
                    {user.roles?.length > 0 ? <div className="flex gap-1 flex-wrap">
                        {user.roles.map((role: string) => <Badge key={role} variant="outline" className="text-xs bg-slate-900 shadow-xl rounded-md border border-[#010d2b]/[0.82]">
                            {formatRoleLabel(role)}
                          </Badge>)}
                      </div> : '-'}
                  </TableCell>
                  <TableCell className="border">
                    <div className="flex gap-2">
                      {(isAdmin || isGestorMaster) && <Button variant={isActive ? "outline" : "default"} size="sm" onClick={() => handleStatusToggle(user.id, user.employment_status || 'ativo')} className="rounded-3xl mx-0 text-sm">
                          {isActive ? <>
                              <UserMinus className="h-4 w-4 mr-1" />
                              Inativar
                            </> : 'Reativar'}
                        </Button>}
                      {(isAdmin || isGestorMaster) && <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)} className="rounded-lg shadow-lg bg-[#ba1c1c]/[0.76] px-[6px] text-sm text-center font-extralight">
                          <Trash2 className="mr-1 rounded-2xl shadow-sm mx-0 px-0 py-0 h-[16px] w-[19px]" />
                          ​
                        </Button>}
                    </div>
                  </TableCell>
                </TableRow>;
          })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>;
}