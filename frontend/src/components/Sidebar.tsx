import React, { useState, useRef } from "react";
import { View, Text, Pressable, Animated, TouchableWithoutFeedback } from "react-native";
import { StyledComponent } from "nativewind";
import { Home, FileText, MessageCircle, User, LogOut, X, Menu, ChevronRight } from "lucide-react-native";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { ParamListBase } from "@react-navigation/native";

// Crear componentes estilizados con NativeWind
const StyledView = StyledComponent(View);
const StyledText = StyledComponent(Text);
const StyledPressable = StyledComponent(Pressable);
const StyledAnimatedView = StyledComponent(Animated.createAnimatedComponent(View));

type SidebarProps = {
    navigation: DrawerNavigationProp<ParamListBase>;
};

export default function Sidebar({ navigation }: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [username, setUsername] = useState("Cargando...");
    const slideAnim = useRef(new Animated.Value(-280)).current;

    const navigationItems = [
        { icon: Home, label: "Home", route: "Home" },
        { icon: FileText, label: "Medical Data", route: "MedicalData" },
        { icon: MessageCircle, label: "Medical Chatbot", route: "Chatbot" }
    ];

    const toggleSidebar = () => {
        Animated.timing(slideAnim, {
            toValue: isOpen ? -280 : 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
        setIsOpen(!isOpen);
    };

    return (
        <TouchableWithoutFeedback onPress={() => isOpen && toggleSidebar()}>
            <StyledAnimatedView 
                className="absolute h-full w-[280px] bg-background-alt z-50"
                style={{ transform: [{ translateX: slideAnim }] }}
            >
                <StyledPressable onPress={toggleSidebar} className="p-5">
                    {isOpen ? <X size={24} color="#2E2E2E" /> : <Menu size={24} color="#2E2E2E" />}
                </StyledPressable>

                {navigationItems.map((item, index) => (
                    <StyledPressable 
                        key={index} 
                        onPress={() => navigation.navigate(item.route)}
                        className="flex-row items-center p-4"
                    >
                        <item.icon size={24} color="#0080cb" />
                        {isOpen && <StyledText className="ml-2 text-text">{item.label}</StyledText>}
                        {isOpen && <ChevronRight size={20} color="#757575" className="ml-auto" />}
                    </StyledPressable>
                ))}

                <StyledView className="absolute bottom-5 left-2 right-2 flex-row items-center bg-primary p-3 rounded-lg">
                    <User size={24} color="#FFFFFF" />
                    {isOpen && <StyledText className="ml-2 text-white">{username}</StyledText>}
                    {isOpen && (
                        <StyledPressable 
                            className="ml-auto" 
                            onPress={() => console.log("Logout")}
                        >
                            <LogOut size={24} color="#FFFFFF" />
                        </StyledPressable>
                    )}
                </StyledView>
            </StyledAnimatedView>
        </TouchableWithoutFeedback>
    );
}