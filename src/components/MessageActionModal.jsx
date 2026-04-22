// src/components/MessageActionModal.jsx
import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";

const MESSAGE_ACTIONS = [
  { key: "reply", label: "Reply" },
  { key: "translate", label: "🌐 Translate" },
  { key: "forward", label: "Forward" },
  { key: "deleteMe", label: "Delete for Me" },
  { key: "deleteEveryone", label: "Delete for Everyone" },
  { key: "pin", label: "Pin" },
  { key: "replyPrivate", label: "Reply Privately" },
];

export default function MessageActionModal({
  visible,
  onClose,
  message,
  onAction,
  currentUser,
}) {
  if (!message) return null;

  const isMyMessage = message.senderId === currentUser.uid;

  // Only show Delete for Everyone if <30 mins old
  const now = new Date();
  const msgTime = message.createdAt?.toDate?.();
  const showDeleteEveryone =
    isMyMessage && msgTime && (now - msgTime) / 1000 / 60 < 30;

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#1e1e1e",
            padding: 20,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "60%",
          }}
        >
          {MESSAGE_ACTIONS.map((action) => {
            if (action.key === "deleteEveryone" && !showDeleteEveryone)
              return null;
            if (action.key === "deleteMe" && !isMyMessage) return null;

            return (
              <TouchableOpacity
                key={action.key}
                style={{ paddingVertical: 12 }}
                onPress={() => onAction(action.key, message)}
              >
                <Text
                  style={{
                    color: action.key.includes("delete") ? "red" : "#fff",
                    fontSize: 16,
                  }}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={{ marginTop: 15 }} onPress={onClose}>
            <Text style={{ color: "red", textAlign: "center" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
