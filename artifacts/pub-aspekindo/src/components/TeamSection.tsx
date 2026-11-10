import { motion } from "framer-motion";
import teamTumpal from "@/assets/team-tumpal.png";
import teamWuryanto from "@/assets/team-wuryanto.png";
import teamHartony from "@/assets/team-hartony.png";
import teamEduard from "@/assets/team-eduard.png";
import teamErwanto from "@/assets/team-erwanto.jpg";

const team = [
  { name: "Tumpal SP Sianipar, SE", role: "Ketua Umum DPN ASPEKINDO", org: "ASPEKINDO", photo: teamTumpal },
  { name: "Wuryanto, SE", role: "Sekretaris Jenderal DPN ASPEKINDO", org: "ASPEKINDO", photo: teamWuryanto },
  { name: "Ir. H. Hartony, ST, MM, IPU", role: "Bendahara Umum", org: "ASPEKINDO", photo: teamHartony },
  { name: "Eduard Berman Hutagalung, ST", role: "Ketua PUB ASPEKINDO", org: "PUB ASPEKINDO", photo: teamEduard },
  { name: "Erwanto Tandrigau, SE", role: "Ketua LSBU Konstruksi Indonesia", org: "LSBU KI", photo: teamErwanto },
];

const TeamSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-sm font-semibold text-pub-amber uppercase tracking-wider font-heading">
            Pengurus
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Tim PUB ASPEKINDO
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Dipimpin oleh para profesional berpengalaman di bidang jasa konstruksi Indonesia.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center group"
            >
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-border shadow-card mb-4 group-hover:border-pub-amber/40 transition-colors">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <h3 className="text-sm font-bold font-heading text-foreground">{member.name}</h3>
              <p className="text-xs text-muted-foreground font-body mt-1">{member.role}</p>
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-pub-amber/10 text-pub-amber font-semibold font-heading">
                {member.org}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamSection;
