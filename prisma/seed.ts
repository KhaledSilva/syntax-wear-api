import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const products = [
	{
		name: "Camiseta Syntax Classic",
		slug: "camiseta-syntax-classic",
		description: "Camiseta essencial em algodao, com modelagem regular e logo discreto.",
		price: 89.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Branco"],
		stock: 40,
		active: true,
	},
	{
		name: "Camiseta Oversized Code",
		slug: "camiseta-oversized-code",
		description: "Camiseta oversized de toque macio para um visual casual.",
		price: 119.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Cinza"],
		stock: 25,
		active: true,
	},
	{
		name: "Moletom Syntax Hoodie",
		slug: "moletom-syntax-hoodie",
		description: "Moletom com capuz, bolso frontal e interior felpado.",
		price: 229.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Verde"],
		stock: 18,
		active: true,
	},
	{
		name: "Calca Jogger Dev",
		slug: "calca-jogger-dev",
		description: "Calca jogger confortavel com cintura ajustavel e bolsos laterais.",
		price: 179.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Cinza"],
		stock: 20,
		active: true,
	},
	{
		name: "Boné Syntax Five Panel",
		slug: "bone-syntax-five-panel",
		description: "Bone five panel com fechamento regulavel e bordado frontal.",
		price: 79.9,
		images: [],
		sizes: ["Unico"],
		colors: ["Preto", "Bege"],
		stock: 32,
		active: true,
	},
	{
		name: "Camiseta Minimal Terminal",
		slug: "camiseta-minimal-terminal",
		description: "Camiseta de algodao com estampa minimalista inspirada no terminal.",
		price: 99.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Branco", "Azul-marinho"],
		stock: 28,
		active: true,
	},
	{
		name: "Jaqueta Windbreaker Commit",
		slug: "jaqueta-windbreaker-commit",
		description: "Jaqueta leve corta-vento com capuz e fechamento em ziper.",
		price: 259.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Verde"],
		stock: 12,
		active: true,
	},
	{
		name: "Shorts Training Loop",
		slug: "shorts-training-loop",
		description: "Shorts versatil com tecido leve, cordao interno e bolsos.",
		price: 109.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Cinza", "Azul-marinho"],
		stock: 24,
		active: true,
	},
	{
		name: "Meias Syntax Pack",
		slug: "meias-syntax-pack",
		description: "Kit com tres pares de meias de cano medio em algodao.",
		price: 49.9,
		images: [],
		sizes: ["Unico"],
		colors: ["Preto", "Branco"],
		stock: 50,
		active: true,
	},
	{
		name: "Camiseta Longline Stack",
		slug: "camiseta-longline-stack",
		description: "Camiseta longline com barra alongada e caimento contemporaneo.",
		price: 109.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Branco"],
		stock: 16,
		active: true,
	},
];

async function main() {
	for (const product of products) {
		await prisma.product.upsert({
			where: { slug: product.slug },
			update: product,
			create: product,
		});
	}

	console.info(`${products.length} produtos inseridos ou atualizados.`);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
