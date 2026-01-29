import { Link } from "wouter";
import { SiX, SiDiscord } from "react-icons/si";
import { TNS_REGISTRY_ADDRESS } from "@/lib/contracts";
import logoImage from "@assets/WhatsApp Image 2025-10-16 at 3.19.59 PM_1760633880162.jpeg";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  const shortAddress = `${TNS_REGISTRY_ADDRESS.substring(0, 6)}...${TNS_REGISTRY_ADDRESS.substring(38)}`;

  const footerLinks = {
    resources: [
      { name: "Documentation", href: "/docs" },
      { name: "API Reference", href: "/docs#technical" },
      { name: "Smart Contracts", href: `https://explorer.intuition.systems/address/${TNS_REGISTRY_ADDRESS}`, external: true },
      { name: "Integration Guide", href: "/docs#registration" },
    ],
    network: [
      { name: "Chain ID: 1155", href: "#" },
      { name: "Currency: TRUST", href: "#" },
      { name: `Contract: ${shortAddress}`, href: `https://explorer.intuition.systems/address/${TNS_REGISTRY_ADDRESS}`, external: true },
      { name: "Block Explorer ↗", href: "https://explorer.intuition.systems", external: true },
      { name: "Add to MetaMask", href: "#" },
    ],
    legal: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
      { name: "Support", href: "/support" },
    ],
  };

  const socialLinks = [
    { name: "X", icon: SiX, href: "https://x.com/TNS_trust", external: true },
    { name: "Discord", icon: SiDiscord, href: "https://discord.gg/J8qZRrTKEf", external: true },
  ];

  return (
    <footer className="bg-trust-dark text-white py-10 sm:py-16 safe-bottom">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Brand Section */}
          <div className="col-span-2">
            <div className="flex items-center mb-4">
              <img 
                src={logoImage} 
                alt="TNS Logo" 
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="text-gray-300 max-w-md mb-6">
              Trust Name Service provides decentralized domain names for the Intuition blockchain ecosystem, 
              making Web3 addresses human-readable and secure.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
                  aria-label={social.name}
                  data-testid={`social-${social.name.toLowerCase()}`}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-1 text-gray-300">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center min-h-[44px] py-2 hover:text-white transition-colors text-sm"
                      data-testid={`footer-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name} ↗
                    </a>
                  ) : (
                    <Link href={link.href}>
                      <span
                        className="inline-flex items-center min-h-[44px] py-2 hover:text-white transition-colors text-sm cursor-pointer"
                        data-testid={`footer-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {link.name}
                      </span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Network */}
          <div>
            <h3 className="font-semibold text-white mb-4">Network</h3>
            <ul className="space-y-1 text-gray-300 text-sm">
              {footerLinks.network.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center min-h-[44px] py-2 hover:text-white transition-colors"
                      data-testid={`footer-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </a>
                  ) : (
                    <span className="inline-flex items-center min-h-[44px] py-2 font-mono" data-testid={`footer-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm mb-4 md:mb-0">
            © {currentYear} Trust Name Service. Built on Intuition blockchain.
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-6 text-sm text-gray-400">
            {footerLinks.legal.map((link) => (
              <Link key={link.name} href={link.href}>
                <span
                  className="inline-flex items-center min-h-[44px] py-2 hover:text-white transition-colors cursor-pointer"
                  data-testid={`footer-legal-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {link.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
