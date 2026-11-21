cmake_minimum_required(VERSION 3.16)
project(KinexaShell LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt5 5.15 REQUIRED COMPONENTS Core Gui Widgets WebEngineWidgets)

add_executable(KinexaShell WIN32 main.cpp)

target_link_libraries(KinexaShell PRIVATE
    Qt5::Core
    Qt5::Gui
    Qt5::Widgets
    Qt5::WebEngineWidgets
)

# 源码为 UTF-8（含中文注释），MSVC 必须显式指定编码。
if(MSVC)
    target_compile_options(KinexaShell PRIVATE /utf-8)
endif()

# Windows 下不弹出控制台窗口
set_target_properties(KinexaShell PROPERTIES
    WIN32_EXECUTABLE TRUE
)
