import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

const PrivateReplyScreen = ({ route, navigation }) => {
  const { message } = route.params;
  const [replyText, setReplyText] = useState("");

  return (
    <View style={styles.container}>
      
      <Text style={styles.title}>Reply Privately</Text>

      <View style={styles.originalBox}>
        <Text style={styles.label}>Original Message:</Text>
        <Text style={styles.originalText}>{message.text}</Text>
      </View>

      <TextInput
        placeholder="Type your private reply..."
        placeholderTextColor="#aaa"
        value={replyText}
        onChangeText={setReplyText}
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.sendBtn}
        onPress={() => {
          console.log("Private reply:", replyText);
          navigation.goBack();
        }}
      >
        <Text style={{ color: "#fff" }}>Send</Text>
      </TouchableOpacity>

    </View>
  );
};

export default PrivateReplyScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    marginBottom: 20,
  },
  originalBox: {
    backgroundColor: "#1e1e1e",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  label: {
    color: "#aaa",
    fontSize: 12,
  },
  originalText: {
    color: "#fff",
    marginTop: 5,
  },
  input: {
    backgroundColor: "#1e1e1e",
    color: "#fff",
    padding: 12,
    borderRadius: 10,
  },
  sendBtn: {
    backgroundColor: "#25D366",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
});
