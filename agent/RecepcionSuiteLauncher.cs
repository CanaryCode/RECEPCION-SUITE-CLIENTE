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

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            
            // Check Server State and Boot if Needed
            bool isServerOnline = IsPortOpen("127.0.0.1", SERVER_PORT);
            if (!isServerOnline)
            {
                // Tries to auto-start the local server
                LaunchServerSilently();
            }

            // Create Beauty UI Form
            using (var form = new Form())
            {
                form.Text = "Recepción Suite - Modo " + (isServerOnline ? "Conectado" : "Local");
                form.Size = new Size(420, 260);
                form.StartPosition = FormStartPosition.CenterScreen;
                form.FormBorderStyle = FormBorderStyle.FixedDialog;
                form.MaximizeBox = false;
                form.MinimizeBox = false;
                form.BackColor = Color.FromArgb(33, 37, 41);

                Label label = new Label();
                label.Text = "¿Qué módulo deseas abrir?";
                label.ForeColor = Color.White;
                label.Font = new Font("Segoe UI", 12f, FontStyle.Bold);
                label.Location = new Point(0, 30);
                label.Size = new Size(400, 30);
                label.TextAlign = ContentAlignment.MiddleCenter;
                form.Controls.Add(label);

                Button btnWeb = new Button();
                btnWeb.Text = "💻 Recepción Web";
                btnWeb.Size = new Size(160, 60);
                btnWeb.Location = new Point(35, 90);
                btnWeb.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
                btnWeb.BackColor = Color.FromArgb(25, 135, 84); // Success BS5
                btnWeb.ForeColor = Color.White;
                btnWeb.FlatStyle = FlatStyle.Flat;
                btnWeb.FlatAppearance.BorderSize = 0;
                btnWeb.Cursor = Cursors.Hand;
                btnWeb.Click += (sender, e) => {
                    OpenUrl("http://localhost:3000");
                    form.Close();
                };
                form.Controls.Add(btnWeb);

                Button btnAdmin = new Button();
                btnAdmin.Text = "⚙️ Consola Admin";
                btnAdmin.Size = new Size(160, 60);
                btnAdmin.Location = new Point(210, 90);
                btnAdmin.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
                btnAdmin.BackColor = Color.FromArgb(13, 110, 253); // Primary BS5
                btnAdmin.ForeColor = Color.White;
                btnAdmin.FlatStyle = FlatStyle.Flat;
                btnAdmin.FlatAppearance.BorderSize = 0;
                btnAdmin.Cursor = Cursors.Hand;
                btnAdmin.Click += (sender, e) => {
                    OpenUrl("http://localhost:3000/admin");
                    form.Close();
                };
                form.Controls.Add(btnAdmin);

                Label paramLabel = new Label();
                paramLabel.Text = isServerOnline 
                    ? "(El servidor local ya está en ejecución)" 
                    : "(El servidor local se está iniciando de fondo)";
                paramLabel.ForeColor = isServerOnline ? Color.LightGreen : Color.LightSalmon;
                paramLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
                paramLabel.Location = new Point(0, 175);
                paramLabel.Size = new Size(400, 30);
                paramLabel.TextAlign = ContentAlignment.MiddleCenter;
                form.Controls.Add(paramLabel);

                form.ShowDialog();
            }
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

        static void LaunchServerSilently()
        {
            string serverPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, SERVER_SCRIPT);

            string nodePath = "node.exe";
            string[] possibleNodePaths = {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "node.exe"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bin", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe")
            };

            foreach (var p in possibleNodePaths)
            {
                if (File.Exists(p)) { nodePath = p; break; }
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + serverPath + "\"",
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true,
                UseShellExecute = false,
                WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
            };

            try { Process.Start(startInfo); Thread.Sleep(1500); } catch { }
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
