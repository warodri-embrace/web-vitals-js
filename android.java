Embrace.getInstance().trackWebViewPerformance(tag, consoleMessage)

// Here's an example code snippet for an Android app:

val webView = findViewById<WebView>(R.id.webView)
val tag = "My WebView 1"

webView.settings.javaScriptEnabled= true

webView.webChromeClient= object : WebChromeClient() {
  override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
		 Embrace.getInstance().trackWebViewPerformance(tag, consoleMessage)
     return super.onConsoleMessage(consoleMessage)
	}
}