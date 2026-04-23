import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  APP_ROLE_VALUES,
  ROLE_OPTIONS,
  ROLE_LABELS,
  USER_CATEGORY_OPTIONS,
  USER_CATEGORY_VALUES,
} from "@/services/adminUsers";
import type { AppRole, UserCategory } from "@/services/adminUsers";
import { isAppRole } from "@/lib/roles";

const passwordRequirementsMessage =
  "A senha deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.";

const roleEnum = z.enum(APP_ROLE_VALUES as readonly [AppRole, ...AppRole[]]);
const userCategoryEnum = z.enum(USER_CATEGORY_VALUES);

const passwordStrength = (password: string) => ({
  lengthOk: password.length >= 8,
  upper: /[A-Z]/.test(password),
  lower: /[a-z]/.test(password),
  digit: /[0-9]/.test(password),
  special: /[^A-Za-z0-9]/.test(password),
});

const baseSchema = z.object({
  fullName: z.string().min(1, "Informe o nome completo."),
  email: z.string().email("Informe um e-mail válido."),
  roles: z.array(roleEnum).min(1, "Selecione ao menos um perfil de acesso."),
  tipo: userCategoryEnum,
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

const createSchema = baseSchema
  .extend({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    const strength = passwordStrength(data.password);

    if (!strength.lengthOk || !strength.upper || !strength.lower || !strength.digit || !strength.special) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: passwordRequirementsMessage,
      });
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "As senhas devem ser idênticas.",
      });
    }
  });

const editSchema = baseSchema.superRefine((data, ctx) => {
  const hasPassword = Boolean(data.password);
  const hasConfirm = Boolean(data.confirmPassword);

  if (hasPassword !== hasConfirm) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: hasPassword ? ["confirmPassword"] : ["password"],
      message: "Preencha os dois campos para alterar a senha.",
    });
    return;
  }

  if (hasPassword && data.password && data.confirmPassword) {
    const strength = passwordStrength(data.password);

    if (!strength.lengthOk || !strength.upper || !strength.lower || !strength.digit || !strength.special) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: passwordRequirementsMessage,
      });
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "As senhas devem ser idênticas.",
      });
    }
  }
});

export type UserFormSubmitValues = {
  fullName: string;
  email: string;
  roles: AppRole[];
  tipo: UserCategory;
  password?: string;
};

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  isSubmitting: boolean;
  initialData?: {
    fullName: string;
    email: string;
    roles: AppRole[];
    tipo: UserCategory;
  };
  onSubmit: (values: UserFormSubmitValues) => Promise<void> | void;
}

type FormValues = z.infer<typeof editSchema>;

export const UserFormDialog = ({
  open,
  onOpenChange,
  mode,
  isSubmitting,
  initialData,
  onSubmit,
}: UserFormDialogProps) => {
  const schema = useMemo(() => (mode === "create" ? createSchema : editSchema), [mode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      roles: [],
      tipo: "colaboradores",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    // Filtrar apenas roles válidas do AppRole
    const validRoles: AppRole[] = [];
    for (const role of (initialData?.roles ?? [])) {
      if (isAppRole(role)) {
        validRoles.push(role);
      }
    }

    form.reset({
      fullName: initialData?.fullName ?? "",
      email: initialData?.email ?? "",
      roles: validRoles,
      tipo: initialData?.tipo ?? "colaboradores",
      password: "",
      confirmPassword: "",
    });
  }, [form, initialData, open]);

  const handleSubmit = async (values: FormValues) => {
    const { confirmPassword: _confirmPassword, ...rest } = values;

    await onSubmit({
      fullName: rest.fullName,
      email: rest.email,
      roles: rest.roles as AppRole[], // Cast to AppRole[]
      tipo: rest.tipo,
      password: rest.password || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Criar usuário" : "Editar usuário"}</DialogTitle>
          <DialogDescription>
            Defina acesso, perfil e credenciais dos colaboradores autorizados.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome e sobrenome" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="usuario@empresa.com"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_CATEGORY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roles"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfis de acesso</FormLabel>
                    <div className="grid gap-2">
                      {ROLE_OPTIONS.map((option) => {
                        const checked = field.value?.includes(option.value) ?? false;
                        const toggleRole = (nextChecked: boolean) => {
                          if (nextChecked) {
                            field.onChange([...(field.value ?? []), option.value]);
                          } else {
                            field.onChange((field.value ?? []).filter((role) => role !== option.value));
                          }
                        };

                        return (
                          <label
                            key={option.value}
                            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{option.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {ROLE_LABELS[option.value]}
                              </span>
                            </div>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) => toggleRole(Boolean(state))}
                              disabled={isSubmitting}
                            />
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {mode === "create"
                        ? passwordRequirementsMessage
                        : "Preencha apenas se desejar alterar a senha."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Repita a senha"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {mode === "create" ? "Criar usuário" : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};