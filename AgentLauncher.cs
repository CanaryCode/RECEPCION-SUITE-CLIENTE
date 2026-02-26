using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace RecepcionAgentLauncher
{
    class Program
    {
        private const int AGENT_PORT = 3001;
        private const string AGENT_URL = "https://www.desdetenerife.com:3000/admin";
        private const string APP_URL = "https://www.desdetenerife.com:3000";
        private const string AGENT_SCRIPT = "agent_v4.js";

        static void Main()
        {
            // Mutex para asegurar una sola instancia
            using (Mutex mutex = new Mutex(false, "Global\\RecepcionAgentLauncherMutex"))
            {
                if (!mutex.WaitOne(TimeSpan.Zero, true))
                {
                    // Si ya hay una instancia, cerramos silenciosamente
                    return;
                }

                try
                {
                    // 1. Verificar si el Agente ya está corriendo
                    if (!IsPortOpen("127.0.0.1", AGENT_PORT))
                    {
                        // 2. Si no corre, iniciarlo de forma silenciosa
                        LaunchAgentSilently();
                        // Dar un par de segundos para que arranque
                        Thread.Sleep(2000);
                    }

                    // 3. Siempre preguntar si desea abrir la consola
                    DialogResult dialogResult = MessageBox.Show(
                        "El Agente de Recepción está activo en segundo plano.\n\n¿Deseas iniciar también la Consola de Administración (requiere login)?\n\n(La aplicación principal se abrirá en cualquier caso)",
                        "Recepción Suite - Agente",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Information);

                    // Abrir siempre la APP principal
                    OpenUrl(APP_URL);

                    if (dialogResult == DialogResult.Yes)
                    {
                        // Abrir además la consola si el usuario lo pide
                        OpenUrl(AGENT_URL);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Error al iniciar el Agente:\n" + ex.Message, "Error Crítico", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        static bool IsPortOpen(string host, int port)
        {
            try
            {
                using (var client = new TcpClient())
                {
                    var result = client.BeginConnect(host, port, null, null);
                    // Aumentamos a 1500ms para mayor fiabilidad
                    var success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(1500));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch { return false; }
        }

        static void LaunchAgentSilently()
        {
            string agentPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, AGENT_SCRIPT);
            
            // Si no estamos en la carpeta del agente, intentar subir un nivel o buscarla
            if (!File.Exists(agentPath)) {
                 // Fallback para ejecución desde raíz
                 agentPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agent", AGENT_SCRIPT);
            }

            string nodePath = "node.exe";

            // Buscar node.exe en sitios comunes si no está en el PATH
            string[] possibleNodePaths = new string[] {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "node.exe"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bin", "node.exe"),
                Path.Combine(Path.GetDirectoryName(AppDomain.CurrentDomain.BaseDirectory), "bin", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe")
            };

            foreach (var p in possibleNodePaths) {
                if (File.Exists(p)) {
                    nodePath = p;
                    break;
                }
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + agentPath + "\"",
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true,
                UseShellExecute = false,
                WorkingDirectory = Path.GetDirectoryName(agentPath)
            };

            try {
                Process.Start(startInfo);
            } catch (Exception) {
                // Último intento: usar 'node' tal cual (confiando en el PATH)
                startInfo.FileName = "node";
                Process.Start(startInfo);
            }
        }

        static void OpenUrl(string url)
        {
            try
            {
                Process.Start(url);
            }
            catch
            {
                // Fallback para entornos donde Process.Start(url) da error
                try {
                    Process.Start(new ProcessStartInfo("cmd", "/c start " + url.Replace("&", "^&")) { CreateNoWindow = true });
                } catch {
                   // Ultimo recurso: UseShellExecute true
                   Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
                }
            }
        }
    }
}
