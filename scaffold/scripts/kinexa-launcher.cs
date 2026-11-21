using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Kinexa 底座启动器：拉起同目录的 OpenToonz.exe，保留其全部功能，
// 只把顶层窗口标题改成 Kinexa。退出时随主程序一起退出，不留后台进程。
class KinexaLauncher
{
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool SetWindowText(IntPtr hWnd, string lpString);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    private static int targetPid;

    private static bool RenameWindow(IntPtr hWnd, IntPtr lParam)
    {
        int pid;
        GetWindowThreadProcessId(hWnd, out pid);
        if (pid != targetPid || !IsWindowVisible(hWnd)) return true;

        StringBuilder title = new StringBuilder(512);
        GetWindowText(hWnd, title, title.Capacity);
        string text = title.ToString();
        if (!text.Contains("OpenToonz")) return true;

        string scene = text;
        int cut = text.IndexOf(" : OpenToonz", StringComparison.Ordinal);
        if (cut > 0) scene = text.Substring(0, cut);
        SetWindowText(hWnd, "Kinexa — " + scene);
        return true;
    }

    private static string Quote(string value)
    {
        if (value.Length == 0) return "\"\"";
        if (!value.Contains(" ") && !value.Contains("\"")) return value;
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    public static void Main(string[] args)
    {
        string self = Process.GetCurrentProcess().MainModule.FileName;
        string root = Path.GetDirectoryName(self);
        string engine = Path.Combine(root, "OpenToonz.exe");
        if (!File.Exists(engine)) return;

        ProcessStartInfo info = new ProcessStartInfo(engine);
        info.WorkingDirectory = root;
        info.UseShellExecute = false;
        if (args.Length > 0)
        {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < args.Length; i++)
            {
                if (i > 0) sb.Append(' ');
                sb.Append(Quote(args[i]));
            }
            info.Arguments = sb.ToString();
        }

        Process child = Process.Start(info);
        if (child == null) return;
        targetPid = child.Id;

        while (!child.HasExited)
        {
            EnumWindows(new EnumWindowsProc(RenameWindow), IntPtr.Zero);
            Thread.Sleep(700);
        }
    }
}
