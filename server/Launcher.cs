using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace RecepcionSuiteLauncher
{
    class Program
    {
        private const int SERVER_PORT = 3000;
        private const string SERVER_URL = "https://www.desdetenerife.com:3000";
        private const string SERVER_SCRIPT = "server/app.js";

        static void Main()
        {
            // Mutex para asegurar una sola instancia
            using (Mutex mutex = new Mutex(false, "Global\\RecepcionSuiteLauncherMutex"))
            {
                if (!mutex.WaitOne(TimeSpan.Zero, true))
                {
                    // Si ya hay una instancia, cerramos silenciosamente
                    return;
                }

                try
                {
                    // 1. Verificar si el Servidor ya está corriendo
                    if (!IsPortOpen("127.0.0.1", SERVER_PORT))
                    {
                        // 2. Si no corre, iniciarlo de forma silenciosa
                        LaunchServerSilently();
                        // Dar tiempo para que arranque el servidor Express
                        Thread.Sleep(3000);
                    }

                    // 3. Informar y preguntar si desea abrir la interfaz
                    DialogResult dialogResult = MessageBox.Show(
                        "El Servidor Hotelero está activo en segundo plano.\n\n¿Deseas abrir la Gestión Hotelera en el navegador?",
                        "Recepción Suite - Servidor",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Information);
                    
                    if (dialogResult == DialogResult.Yes)
                    {
                        OpenUrl(SERVER_URL);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Error al iniciar el Servidor Central:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
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

        static void LaunchServerSilently()
        {
            // Determinar la ruta base
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverPath = Path.Combine(baseDir, SERVER_SCRIPT);

            // Si el ejecutable está en /server, subir un nivel
            if (!File.Exists(serverPath)) {
                string parentDir = Directory.GetParent(baseDir)?.FullName;
                if (parentDir != null) {
                    serverPath = Path.Combine(parentDir, SERVER_SCRIPT);
                }
            }

            if (!File.Exists(serverPath)) {
                throw new FileNotFoundException("No se encuentra " + SERVER_SCRIPT + " en la ruta: " + serverPath);
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = "node.exe",
                Arguments = "\"" + serverPath + "\"",
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true,
                UseShellExecute = false,
                WorkingDirectory = Path.GetDirectoryName(Path.GetDirectoryName(serverPath)) // Raíz del proyecto
            };

            try {
                Process.Start(startInfo);
            } catch (Exception) {
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
                    Process.Start(new ProcessStartInfo("cmd", $"/c start {url.Replace("&", "^&")}") { CreateNoWindow = true });
                } catch {
                   // Ultimo recurso: UseShellExecute true
                   Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
                }
            }
        }
    }
}
