import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import auth from "@react-native-firebase/auth";

import ContactListScreen from "../screens/ContactListScreen";
import ChatScreen from "../screens/ChatScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator({ user }: any) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Contacts">
          {(props) => (
            <ContactListScreen
              {...props}
              currentUser={user}
              onLogout={() => auth().signOut()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Chat">
          {(props) => <ChatScreen {...props} currentUser={user} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
