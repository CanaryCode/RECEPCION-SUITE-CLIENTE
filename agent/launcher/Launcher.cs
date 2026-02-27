using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace RecepcionSuiteLauncher
{
    static class Program
    {
        private const int SERVER_PORT = 3000;
        private const string SERVER_SCRIPT = "server_v4.js";
        private const int AGENT_PORT = 3001;
        private const string AGENT_SCRIPT = "agent/src/index.js";

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            // Check Server & Agent States
            bool isServerOnline = IsPortOpen("127.0.0.1", SERVER_PORT);
            bool isAgentOnline = IsPortOpen("127.0.0.1", AGENT_PORT);

            if (!isServerOnline) LaunchProcessSilently(SERVER_SCRIPT);
            if (!isAgentOnline) LaunchProcessSilently(AGENT_SCRIPT);

            // Directly open the web application
            OpenUrl("https://www.desdetenerife.com:3000");
        }

        static bool IsPortOpen(string host, int port)
        {
            try
            {
                using (var client = new TcpClient())
                {
                    var result = client.BeginConnect(host, port, null, null);
                    var success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(500));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch { return false; }
        }

        static void LaunchProcessSilently(string scriptName)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string scriptPath = Path.Combine(baseDir, scriptName);

            // Búsqueda inteligente para estructura agent/src/index.js
            if (!File.Exists(scriptPath))
            {
                // 1. Probar en directorio superior
                string parentDir = Path.GetDirectoryName(baseDir.TrimEnd(Path.DirectorySeparatorChar));
                if (File.Exists(Path.Combine(parentDir, scriptName)))
                {
                    baseDir = parentDir;
                    scriptPath = Path.Combine(baseDir, scriptName);
                }
                // 2. Si estamos dentro dset "SOURCE=Launcher.cs"
// The following lines appear to be from a batch script and cannot be inserted into C# code.
// set "OUTPUT=RecepcionSuite.exe"
// set "ICON=..\resources\images\icono.ico"
                else if (scriptName.Contains("agent/")) {
                    string altPath = Path.Combine(baseDir, "../../", scriptName);
                    if (File.Exists(altPath)) {
                        scriptPath = altPath;
                        baseDir = Path.GetDirectoryName(Path.GetDirectoryName(altPath));
                    }
                }
            }

            if (!File.Exists(scriptPath)) return;

            string nodePath = "node.exe";
            string[] possibleNodePaths = {
                Path.Combine(baseDir, "node.exe"),
                Path.Combine(baseDir, "bin", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe")
            };

            foreach (var p in possibleNodePaths)
            {
                if (File.Exists(p)) { nodePath = p; break; }
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + scriptPath + "\"",
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true,
                UseShellExecute = false,
                WorkingDirectory = baseDir
            };

            try { Process.Start(startInfo); } catch { }
        }

        static void OpenUrl(string url)
        {
            try { Process.Start(url); }
            catch 
            {
                try { Process.Start(new ProcessStartInfo("cmd", "/c start " + url.Replace("&", "^&")) { CreateNoWindow = true }); }
                catch { Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true }); }
            }
        }
    }
}
