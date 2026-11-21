@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1
cmake -S "D:\20533\deskbox\fangwork\Kinexa\shell" -B "D:\20533\deskbox\fangwork\Kinexa\build\shell" -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH="C:/Qt/5.15.2/msvc2019_64"
if errorlevel 1 exit /b 1
cmake --build "D:\20533\deskbox\fangwork\Kinexa\build\shell" --target KinexaShell
