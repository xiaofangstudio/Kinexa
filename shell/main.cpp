// Kinexa 外壳：Qt WebEngine 承载 Kinexa 的 React 界面。
// 旧版 OpenToonz Qt 工作区不再作为主界面，只保留其内核能力。

#include <QApplication>
#include <QCursor>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QHostAddress>
#include <QIcon>
#include <QMainWindow>
#include <QMimeDatabase>
#include <QTcpServer>
#include <QTcpSocket>
#include <QUrl>
#include <QWebEnginePage>
#include <QWebEngineProfile>
#include <QWebEngineScript>
#include <QWebEngineScriptCollection>
#include <QWebEngineSettings>
#include <QWebEngineView>
#include <QtGlobal>
#include <iostream>

namespace {

QString contentTypeFor(const QString &path) {
  const QString suffix = QFileInfo(path).suffix().toLower();
  if (suffix == "html" || suffix == "htm") return QStringLiteral("text/html");
  if (suffix == "js" || suffix == "mjs")
    return QStringLiteral("application/javascript");
  if (suffix == "css") return QStringLiteral("text/css");
  if (suffix == "json") return QStringLiteral("application/json");
  if (suffix == "svg") return QStringLiteral("image/svg+xml");
  if (suffix == "png") return QStringLiteral("image/png");
  if (suffix == "jpg" || suffix == "jpeg") return QStringLiteral("image/jpeg");
  if (suffix == "webp") return QStringLiteral("image/webp");
  if (suffix == "woff2") return QStringLiteral("font/woff2");
  if (suffix == "woff") return QStringLiteral("font/woff");
  if (suffix == "ttf") return QStringLiteral("font/ttf");
  return QStringLiteral("application/octet-stream");
}

// 用本机回环 HTTP 提供前端文件。Chromium 不允许从 file:// 加载 module script，
// 因此不能用 file:// 直接打开 Vite 产物。
class LocalUiServer : public QTcpServer {
public:
  explicit LocalUiServer(QString root, QObject *parent = nullptr)
      : QTcpServer(parent), m_root(std::move(root)) {}

  bool start() { return listen(QHostAddress::LocalHost, 0); }

  QString baseUrl() const {
    return QStringLiteral("http://127.0.0.1:%1/").arg(serverPort());
  }

protected:
  void incomingConnection(qintptr handle) override {
    auto *socket = new QTcpSocket(this);
    socket->setSocketDescriptor(handle);
    connect(socket, &QTcpSocket::readyRead, socket, [socket, this] {
      const QByteArray request = socket->readAll();
      const QList<QByteArray> lines = request.split('\n');
      if (lines.isEmpty()) {
        socket->disconnectFromHost();
        return;
      }
      const QByteArray target = lines.first().split(' ').value(1);
      QString path = QUrl::fromPercentEncoding(target);
      if (path.isEmpty() || path == "/") path = "/index.html";
      if (path.contains("..")) {
        respond(socket, 403, "text/plain", "forbidden");
        return;
      }
      QFile file(m_root + path);
      if (!file.open(QIODevice::ReadOnly)) {
        respond(socket, 404, "text/plain", "not found");
        return;
      }
      const QByteArray body = file.readAll();
      respond(socket, 200, contentTypeFor(path), body);
    });
    connect(socket, &QTcpSocket::disconnected, socket,
            &QTcpSocket::deleteLater);
  }

private:
  void respond(QTcpSocket *socket, int code, const QString &type,
               const QByteArray &body) {
    QByteArray head = "HTTP/1.1 " + QByteArray::number(code) + " OK\r\n";
    head += "Content-Type: " + type.toUtf8() + "; charset=utf-8\r\n";
    head += "Content-Length: " + QByteArray::number(body.size()) + "\r\n";
    head += "Cache-Control: no-store\r\n";
    head += "Connection: close\r\n\r\n";
    socket->write(head);
    socket->write(body);
    socket->disconnectFromHost();
  }

  QString m_root;
};

// 把前端 console 输出转到标准输出，便于开发期排查。
class KinexaPage : public QWebEnginePage {
public:
  using QWebEnginePage::QWebEnginePage;

protected:
  void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level,
                                const QString &message, int lineNumber,
                                const QString &sourceId) override {
    std::cout << "[ui] " << sourceId.toStdString() << ":" << lineNumber << " "
              << message.toStdString() << std::endl;
  }
};

}  // namespace

int main(int argc, char *argv[]) {
  QApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
  QApplication::setAttribute(Qt::AA_UseHighDpiPixmaps);
  QApplication app(argc, argv);
  app.setApplicationName(QStringLiteral("Kinexa"));
  app.setOrganizationName(QStringLiteral("小方工作室"));

  QMainWindow window;
  window.setWindowTitle(QStringLiteral("Kinexa"));
  window.setMinimumSize(1180, 760);
  window.resize(1440, 900);

  const QDir appDir(QCoreApplication::applicationDirPath());
  const QFileInfo iconFile(appDir.filePath(QStringLiteral("kinexa.ico")));
  if (iconFile.exists())
    window.setWindowIcon(QIcon(iconFile.absoluteFilePath()));

  auto *profile = QWebEngineProfile::defaultProfile();
  profile->settings()->setAttribute(
      QWebEngineSettings::LocalContentCanAccessFileUrls, true);
  profile->settings()->setAttribute(
      QWebEngineSettings::LocalContentCanAccessRemoteUrls, false);
  profile->settings()->setAttribute(QWebEngineSettings::FocusOnNavigationEnabled,
                                    true);

  auto *view = new QWebEngineView(&window);
  auto *page = new KinexaPage(profile, view);
  view->setPage(page);
  view->setContextMenuPolicy(Qt::NoContextMenu);
  window.setCentralWidget(view);

  // 让前端知道当前跑在 Kinexa Qt 外壳里，而不是 Tauri。
  QWebEngineScript script;
  script.setName(QStringLiteral("kinexa-qt-flag"));
  script.setInjectionPoint(QWebEngineScript::DocumentCreation);
  script.setWorldId(QWebEngineScript::MainWorld);
  script.setSourceCode(QStringLiteral(
      "window.__KINEXA_SHELL__ = 'qt';"
      "window.__KINEXA_QT__ = true;"));
  page->scripts().insert(script);

  const QString uiPath = appDir.filePath(QStringLiteral("ui"));
  if (!QFileInfo::exists(uiPath + QStringLiteral("/index.html"))) {
    std::cerr << "Kinexa UI not found: " << uiPath.toStdString() << std::endl;
    return 2;
  }

  LocalUiServer server(uiPath);
  if (!server.start()) {
    std::cerr << "Kinexa local UI server failed to start" << std::endl;
    return 2;
  }
  view->load(QUrl(server.baseUrl()));

  window.show();
  return app.exec();
}
