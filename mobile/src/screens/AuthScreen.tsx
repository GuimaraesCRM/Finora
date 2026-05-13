import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../theme";
import { useSession } from "../lib/session";
import { LabeledField, PrimaryButton, SurfaceCard } from "../components/ui";

export function AuthScreen() {
  const palette = usePalette();
  const session = useSession();
  const [mode, setMode] = useState<"login" | "register" | "setup">(session.setupRequired ? "setup" : "login");
  const [form, setForm] = useState({ name: "", email: "", password: "", seedDemo: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const createMode = mode === "register" || mode === "setup";

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await session.signIn(form.email, form.password);
      } else if (mode === "register") {
        await session.register(form);
      } else {
        await session.setup(form);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={[palette.background, palette.surfaceSoft, palette.background]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 20 }}>
        <SurfaceCard style={{ padding: 22 }}>
          <View style={{ gap: 12 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="wallet" size={28} color="#fff" />
            </View>
            <View>
              <Text style={{ color: palette.text, fontSize: 34, fontWeight: "900" }}>Finora</Text>
              <Text style={{ color: palette.muted, marginTop: 6, fontSize: 15 }}>
                {createMode ? "Conta pessoal sincronizada com o Finora web." : "Seu controle financeiro agora cabe no iPhone."}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 24 }}>
            <Pressable onPress={() => setMode("login")} style={[styles.modeButton, { backgroundColor: mode === "login" ? palette.primary : palette.surfaceSoft }]}>
              <Text style={{ color: mode === "login" ? "#fff" : palette.text, fontWeight: "800" }}>Entrar</Text>
            </Pressable>
            {!session.setupRequired && (
              <Pressable onPress={() => setMode("register")} style={[styles.modeButton, { backgroundColor: mode === "register" ? palette.primary : palette.surfaceSoft }]}>
                <Text style={{ color: mode === "register" ? "#fff" : palette.text, fontWeight: "800" }}>Criar conta</Text>
              </Pressable>
            )}
          </View>

          <View style={{ gap: 14, marginTop: 22 }}>
            {createMode && (
              <LabeledField
                label="Nome"
                value={form.name}
                onChangeText={(name) => setForm((current) => ({ ...current, name }))}
                placeholder="Seu nome"
              />
            )}
            <LabeledField
              label="E-mail"
              value={form.email}
              onChangeText={(email) => setForm((current) => ({ ...current, email }))}
              placeholder="voce@exemplo.com"
              keyboardType="email-address"
            />
            <LabeledField
              label="Senha"
              value={form.password}
              onChangeText={(password) => setForm((current) => ({ ...current, password }))}
              placeholder="Minimo de 8 caracteres"
            />

            {createMode && (
              <View style={[styles.seedBox, { backgroundColor: palette.surfaceSoft, borderColor: palette.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: "800" }}>Comecar com dados de exemplo</Text>
                  <Text style={{ color: palette.muted, marginTop: 5, fontSize: 13 }}>Ajuda a testar o app mais rapido no primeiro acesso.</Text>
                </View>
                <Switch
                  value={form.seedDemo}
                  onValueChange={(seedDemo) => setForm((current) => ({ ...current, seedDemo }))}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            )}

            {!!error && <Text style={{ color: palette.bad, fontWeight: "700" }}>{error}</Text>}

            <PrimaryButton
              label={busy ? "Continuando..." : createMode ? "Criar acesso" : "Entrar no app"}
              onPress={submit}
              icon={createMode ? "person-add-outline" : "log-in-outline"}
              disabled={busy}
            />
          </View>
        </SurfaceCard>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  modeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  seedBox: {
    minHeight: 72,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
