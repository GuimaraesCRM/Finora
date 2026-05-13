import "react-native-url-polyfill/auto";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, Text, View, useColorScheme } from "react-native";
import { SessionProvider, useSession } from "./src/lib/session";
import { usePalette } from "./src/theme";
import { AuthScreen } from "./src/screens/AuthScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { TransactionsScreen } from "./src/screens/TransactionsScreen";
import { AccountsScreen } from "./src/screens/AccountsScreen";
import { MoreScreen } from "./src/screens/MoreScreen";

const Tab = createBottomTabNavigator();

function AppShell() {
  const session = useSession();
  const palette = usePalette();
  const scheme = useColorScheme();

  if (session.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={{ color: palette.muted, fontSize: 15 }}>Carregando Finora...</Text>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </View>
    );
  }

  if (!session.token || !session.user) {
    return (
      <>
        <AuthScreen />
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </>
    );
  }

  return (
    <>
      <NavigationContainer theme={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: palette.primary,
            tabBarInactiveTintColor: palette.muted,
            tabBarStyle: {
              backgroundColor: palette.surface,
              borderTopColor: palette.border,
              height: 84,
              paddingTop: 8,
              paddingBottom: 22,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
            tabBarIcon: ({ color, size, focused }) => {
              const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
                Dashboard: focused ? "pie-chart" : "pie-chart-outline",
                Transactions: focused ? "receipt" : "receipt-outline",
                Accounts: focused ? "wallet" : "wallet-outline",
                More: focused ? "grid" : "grid-outline",
              };
              return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Resumo" }} />
          <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: "Lancamentos" }} />
          <Tab.Screen name="Accounts" component={AccountsScreen} options={{ title: "Contas" }} />
          <Tab.Screen name="More" component={MoreScreen} options={{ title: "Mais" }} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <AppShell />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
